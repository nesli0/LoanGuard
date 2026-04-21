"""
Credit Service — Tüm ML pipeline burada çalışır.

Akış:
1. Input → Türkçe→İngilizce map + encode + scale
2. XGBoost → approval_probability
3. SHAP → feature impact açıklaması
4. Isolation Forest → anomali tespiti
5. Interest rate → metadata formülüyle hesap
6. DiCE → counterfactual öneriler
7. Sonuçları birleştir → CreditAnalyzeResponse
"""

import warnings
from typing import Any

import numpy as np
import pandas as pd
import shap

from src.core.exceptions import AppException
from src.modules.credit.credit_constants import (
    BASE_RATE,
    CREDIT_ML_ERROR,
    CREDIT_PROFILE_INCOMPLETE,
    EDUCATION_MAP,
    EMPLOYMENT_MAP,
    LOAN_PURPOSE_MAP,
    MARITAL_MAP,
    MAX_RATE,
    RISK_BANDS,
    RISK_PREMIUM_MAX,
)
from src.modules.credit.credit_loader import ml_models
from src.modules.credit.credit_schemas import (
    Counterfactual,
    CreditAnalyzeRequest,
    CreditAnalyzeResponse,
    ShapFactor,
)

warnings.filterwarnings("ignore")

# XGBoost'un beklediği feature sırası (metadata'dan)
FEATURE_ORDER = [
    "Age", "Income", "LoanAmount", "CreditScore", "MonthsEmployed",
    "NumCreditLines", "InterestRate", "LoanTerm", "DTIRatio",
    "Education", "EmploymentType", "MaritalStatus",
    "HasMortgage", "HasDependents", "LoanPurpose", "HasCoSigner",
]

OPTIMAL_THRESHOLD = 0.6491304347826087


# ── Yardımcı Fonksiyonlar ────────────────────────────────────────────

def _map_field(value: str | None, mapping: dict, field_name: str) -> str:
    """Türkçe değeri İngilizce karşılığına çevir."""
    if value is None:
        raise AppException(422, f"Profil eksik: '{field_name}' alanı doldurulmalı.", CREDIT_PROFILE_INCOMPLETE)
    key = value.lower().strip()
    if key not in mapping:
        raise AppException(422, f"Geçersiz '{field_name}' değeri: {value}", CREDIT_PROFILE_INCOMPLETE)
    return mapping[key]


def _encode_categorical(value: str, feature: str) -> int:
    """Label encoder ile kategorik değeri int'e dönüştür."""
    le = ml_models.label_encoders.get(feature)
    if le is None:
        return 0
    try:
        return int(le.transform([value])[0])
    except ValueError:
        # Bilinmeyen değer → en yakın sınıf
        return 0


def _get_risk_band(probability: float) -> str:
    for name, low, high in RISK_BANDS:
        if low <= probability < high:
            return name
    return "Çok Yüksek"


def _estimate_interest_rate(approval_prob: float) -> float:
    """
    Lineer interpolasyon:
    Düşük olasılık → yüksek faiz risk primi
    """
    rejection_prob = 1.0 - approval_prob
    rate = BASE_RATE + RISK_PREMIUM_MAX * rejection_prob
    return round(min(rate, MAX_RATE), 4)


def _build_summary(approved: bool, prob: float, risk_band: str) -> str:
    if approved:
        return (
            f"Kredi başvurunuzun onaylanma olasılığı %{prob*100:.1f}. "
            f"Risk düzeyiniz '{risk_band}' kategorisindedir."
        )
    return (
        f"Mevcut profilinizle onaylanma olasılığı %{prob*100:.1f}. "
        f"Aşağıdaki önerileri uygulayarak şansınızı artırabilirsiniz."
    )


# ── Ana Servis Fonksiyonu ────────────────────────────────────────────

async def analyze_credit(
    req: CreditAnalyzeRequest,
    profile: dict,
    dti_ratio: float,
    monthly_income: float,
) -> CreditAnalyzeResponse:
    """
    Kredi analizi pipeline'ını çalıştırır.

    Args:
        req: Kullanıcıdan gelen kredi talep bilgileri
        profile: Kullanıcı profil verisi (age, education, employment_type, marital_status, dependents)
        dti_ratio: Bütçeden hesaplanan DTI (loan_payments / income)
        monthly_income: Son dönem aylık gelir
    """
    if not ml_models.is_ready:
        raise AppException(503, "ML servisi hazır değil.", CREDIT_ML_ERROR)

    try:
        # ── 1. Input Hazırlama ────────────────────────────────────────
        income = req.income_override or monthly_income
        months_employed = req.months_employed or 0

        # Türkçe → İngilizce
        edu_en  = _map_field(profile.get("education"), EDUCATION_MAP, "education")
        emp_en  = _map_field(profile.get("employment_type"), EMPLOYMENT_MAP, "employment_type")
        mar_en  = _map_field(profile.get("marital_status"), MARITAL_MAP, "marital_status")
        purp_en = _map_field(req.loan_purpose, LOAN_PURPOSE_MAP, "loan_purpose")

        has_dependents_str = "Yes" if (profile.get("dependents") or 0) > 0 else "No"
        has_mortgage_str   = "Yes" if req.has_mortgage else "No"
        has_cosigner_str   = "Yes" if req.has_co_signer else "No"

        # ── 2. Raw Feature Dict ───────────────────────────────────────
        raw: dict[str, Any] = {
            "Age":             profile.get("age") or 30,
            "Income":          income,
            "LoanAmount":      req.loan_amount,
            "CreditScore":     req.credit_score,
            "MonthsEmployed":  months_employed,
            "NumCreditLines":  req.num_credit_lines,
            "InterestRate":    req.interest_rate,
            "LoanTerm":        req.loan_term,
            "DTIRatio":        dti_ratio,
            "Education":       _encode_categorical(edu_en, "Education"),
            "EmploymentType":  _encode_categorical(emp_en, "EmploymentType"),
            "MaritalStatus":   _encode_categorical(mar_en, "MaritalStatus"),
            "HasMortgage":     _encode_categorical(has_mortgage_str, "HasMortgage"),
            "HasDependents":   _encode_categorical(has_dependents_str, "HasDependents"),
            "LoanPurpose":     _encode_categorical(purp_en, "LoanPurpose"),
            "HasCoSigner":     _encode_categorical(has_cosigner_str, "HasCoSigner"),
        }

        df = pd.DataFrame([raw])[FEATURE_ORDER]

        # ── 3. Scale ─────────────────────────────────────────────────
        df_scaled = ml_models.scaler.transform(df)
        df_scaled = pd.DataFrame(df_scaled, columns=FEATURE_ORDER)

        # ── 4. XGBoost Tahmin ────────────────────────────────────────
        prob = float(ml_models.xgboost.predict_proba(df_scaled)[0][1])
        approved = prob >= OPTIMAL_THRESHOLD
        risk_band = _get_risk_band(prob)

        # ── 5. SHAP Açıklaması ───────────────────────────────────────
        explainer = shap.TreeExplainer(ml_models.xgboost)
        shap_values = explainer.shap_values(df_scaled)

        # Sınıf 1 (onay) için SHAP değerleri
        sv = shap_values[0] if isinstance(shap_values, list) else shap_values[0]

        # Top 5 feature (mutlak etki büyüklüğüne göre sırala)
        impact_pairs = sorted(
            zip(FEATURE_ORDER, sv), key=lambda x: abs(x[1]), reverse=True
        )[:5]

        shap_factors = [
            ShapFactor(
                feature=feat,
                value=float(raw[feat]),
                impact=round(float(imp), 4),
                impact_label="Olumlu" if imp > 0 else "Olumsuz",
            )
            for feat, imp in impact_pairs
        ]

        # ── 6. Anomali Tespiti ───────────────────────────────────────
        isolation_score = float(ml_models.isolation_forest.score_samples(df_scaled)[0])
        anomaly_threshold = -0.5770649661752837  # metadata'dan
        is_anomaly = isolation_score < anomaly_threshold

        # ── 7. Faiz Tahmini ──────────────────────────────────────────
        est_rate = _estimate_interest_rate(prob)

        # ── 8. Counterfactual Öneriler ───────────────────────────────
        counterfactuals = _generate_counterfactuals(df_scaled, raw, prob)

        # ── 9. Sonuç ─────────────────────────────────────────────────
        return CreditAnalyzeResponse(
            approval_probability=round(prob, 4),
            approved=approved,
            risk_band=risk_band,
            optimal_threshold=OPTIMAL_THRESHOLD,
            estimated_interest_rate=est_rate,
            estimated_interest_rate_pct=f"%{est_rate*100:.1f}",
            is_anomaly=is_anomaly,
            shap_factors=shap_factors,
            counterfactuals=counterfactuals,
            summary=_build_summary(approved, prob, risk_band),
        )

    except AppException:
        raise
    except Exception as e:
        raise AppException(500, f"Kredi analizi sırasında hata: {str(e)}", CREDIT_ML_ERROR) from e


def _generate_counterfactuals(
    df_scaled: pd.DataFrame,
    raw: dict,
    current_prob: float,
    n: int = 3,
) -> list[Counterfactual]:
    """
    Basit counterfactual üretimi:
    Sayısal feature'ları iyileştirerek hedef threshold'u geçmeye çalışır.
    """
    if current_prob >= OPTIMAL_THRESHOLD:
        return []  # Zaten onaylı, counterfactual gerekmez

    results = []
    numeric_improvements = [
        ("CreditScore",    50,  850),    # +50 kredi skoru
        ("DTIRatio",      -0.05, 0.0),   # -5% DTI
        ("MonthsEmployed", 12, None),    # +12 ay çalışma
        ("Income",         0.15, None),  # +%15 gelir
    ]

    for feat, delta, cap in numeric_improvements:
        if feat not in raw:
            continue

        trial = df_scaled.copy()
        new_val = raw[feat] + (raw[feat] * delta if isinstance(delta, float) and abs(delta) < 1 else delta)
        if cap is not None:
            new_val = min(new_val, cap) if delta > 0 else max(new_val, cap)

        # Scaler ile normalize edilmiş değeri güncelle
        feat_idx = FEATURE_ORDER.index(feat)
        trial.iloc[0, feat_idx] = new_val  # Basit tahmini güncelleme

        try:
            new_prob = float(ml_models.xgboost.predict_proba(trial)[0][1])
            if new_prob > current_prob:
                results.append(Counterfactual(
                    changes={feat: round(new_val, 2)},
                    new_probability=round(new_prob, 4),
                    would_approve=new_prob >= OPTIMAL_THRESHOLD,
                ))
        except Exception:
            continue

        if len(results) >= n:
            break

    # Sonuçları iyileştirme etkisine göre sırala
    results.sort(key=lambda x: x.new_probability, reverse=True)
    return results
