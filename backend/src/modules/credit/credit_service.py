"""
Credit Service — LoanGuardPredictor pipeline'ını çağırır.

Akış:
1. Request → Türkçe→İngilizce map + birim dönüşümleri
2. LoanGuardPredictor.predict() → anomaly_flag, risk_score, decision,
                                   interest_rate, shap_top3
3. decision == "rejected" → DiceExplainer.generate_counterfactuals()
4. Sonuçları CreditAnalyzeResponse'a map et

NOT:
- Preprocessing (encode, ratio hesaplama, scale) predictor içinde yapılıyor.
- InterestRate: frontend ondalık (0.125) gönderir; biz ×100 yaparak
  modele % olarak (12.5) iletiriz (B seçeneği — frontend değişmez).
- risk_score: temerrüt olasılığı. Düşük = iyi. approval_probability = 1 - risk_score.
"""

import warnings

from src.core.exceptions import AppException
from src.modules.credit.credit_constants import (
    APPROVAL_BANDS,
    CREDIT_ML_ERROR,
    CREDIT_PROFILE_INCOMPLETE,
    EDUCATION_MAP,
    EMPLOYMENT_MAP,
    FEATURE_NAMES_TR,
    LOAN_PURPOSE_MAP,
    MARITAL_MAP,
)
from src.modules.credit.credit_loader import ml_loader
from src.modules.credit.credit_schemas import (
    Counterfactual,
    CreditAnalyzeRequest,
    CreditAnalyzeResponse,
    ShapFactor,
)

warnings.filterwarnings("ignore")


# ── Yardımcı Fonksiyonlar ────────────────────────────────────────────

def _map_field(value: str | None, mapping: dict, field_name: str) -> str:
    """Türkçe değeri İngilizce karşılığına çevir."""
    if value is None:
        raise AppException(422, f"Profil eksik: '{field_name}' alanı doldurulmalı.", CREDIT_PROFILE_INCOMPLETE)
    # "İ" (U+0130) → Python .lower() produces "i̇" (combining dot), not "i".
    # Replace manually before lowercasing to handle Turkish capital İ correctly.
    key = value.replace("İ", "i").replace("I", "ı").lower().strip()
    if key not in mapping:
        raise AppException(422, f"Geçersiz '{field_name}' değeri: {value}", CREDIT_PROFILE_INCOMPLETE)
    return mapping[key]


def _get_approval_band(approval_probability: float) -> str:
    """approval_probability (0–1) → insan okunur onaylanma bandı."""
    for name, low, high in APPROVAL_BANDS:
        if low <= approval_probability < high:
            return name
    return "Çok Yüksek Onaylanma Şansı"


def _build_summary(approved: bool, approval_probability: float, approval_band: str) -> str:
    pct = approval_probability * 100
    if approved:
        return (
            f"Kredi başvurunuzun onaylanma olasılığı %{pct:.1f}. "
            f"Durumunuz '{approval_band}' kategorisindedir."
        )
    return (
        f"Mevcut profilinizle onaylanma olasılığı %{pct:.1f}. "
        f"Aşağıdaki counterfactual senaryolarını uygulayarak şansınızı artırabilirsiniz."
    )


# ── Ana Servis Fonksiyonu ────────────────────────────────────────────

async def analyze_credit(
    req: CreditAnalyzeRequest,
    profile: dict,
    dti_ratio: float,
    monthly_income: float,
) -> CreditAnalyzeResponse:
    """
    LoanGuardPredictor pipeline'ını çalıştırır.

    Args:
        req: Kullanıcıdan gelen kredi talep bilgileri
        profile: Kullanıcı profil verisi (age, education, employment_type, marital_status, dependents)
        dti_ratio: Bütçeden hesaplanan DTI (loan_payments / income)
        monthly_income: Son dönem aylık gelir
    """
    if not ml_loader.is_ready:
        raise AppException(503, "ML servisi hazır değil.", CREDIT_ML_ERROR)

    try:
        # ── 1. Input Hazırlama ────────────────────────────────────────
        income = req.income_override or monthly_income
        months_employed = req.months_employed or 0

        # Türkçe → İngilizce (string kategorikler; predictor encode eder)
        edu_en  = _map_field(profile.get("education"),       EDUCATION_MAP,    "education")
        emp_en  = _map_field(profile.get("employment_type"), EMPLOYMENT_MAP,   "employment_type")
        mar_en  = _map_field(profile.get("marital_status"),  MARITAL_MAP,      "marital_status")
        purp_en = _map_field(req.loan_purpose,               LOAN_PURPOSE_MAP, "loan_purpose")

        has_dependents_str = "Yes" if (profile.get("dependents") or 0) > 0 else "No"
        has_mortgage_str   = "Yes" if req.has_mortgage   else "No"
        has_cosigner_str   = "Yes" if req.has_co_signer  else "No"

        # InterestRate: frontend ondalık (0.125) → model % (12.5) [Seçenek B]
        interest_rate_pct = req.interest_rate * 100

        # LoanGuardPredictor beklediği format (ham veri, string kategorikler)
        model_input = {
            "Age":            profile.get("age") or 30,
            "Income":         income,
            "LoanAmount":     req.loan_amount,
            "CreditScore":    req.credit_score,
            "MonthsEmployed": months_employed,
            "NumCreditLines": req.num_credit_lines,
            "InterestRate":   interest_rate_pct,      # % formatında
            "LoanTerm":       req.loan_term,
            "DTIRatio":       dti_ratio,
            "Education":      edu_en,
            "EmploymentType": emp_en,
            "MaritalStatus":  mar_en,
            "HasMortgage":    has_mortgage_str,
            "HasDependents":  has_dependents_str,
            "LoanPurpose":    purp_en,
            "HasCoSigner":    has_cosigner_str,
        }

        # ── 2. Predictor Pipeline ─────────────────────────────────────
        # Içeride: encode → add_ratios (4 yeni feature) → scale → XGBoost → SHAP
        try:
            raw_result = ml_loader.predictor.predict(model_input)
        except ValueError as e:
            # Unseen categorical değer → 400 Bad Request
            raise AppException(400, str(e), CREDIT_PROFILE_INCOMPLETE) from e

        risk_score          = raw_result["risk_score"]           # temerrüt olasılığı (düşük=iyi)
        approval_probability = round(1.0 - risk_score, 4)        # onaylanma ihtimali
        approved            = raw_result["decision"] == "approved"
        is_anomaly          = raw_result["anomaly_flag"]
        approval_band       = _get_approval_band(approval_probability)

        # ── 3. SHAP Mapping ───────────────────────────────────────────
        # Predictor top3 döndürür; biz türkçe ad ve impact_label ekleriz
        shap_factors = [
            ShapFactor(
                feature=item["feature"],
                feature_tr=FEATURE_NAMES_TR.get(item["feature"], item["feature"]),
                direction=item["direction"],
                shap_value=item["shap_value"],
                # "+" yönü = riski artırdı = olumsuz (temerrüt modelinde)
                impact_label="Olumsuz" if item["direction"] == "+" else "Olumlu",
            )
            for item in raw_result["shap_top3"]
        ]

        # ── 4. Faiz Tahmini ───────────────────────────────────────────
        # Predictor zaten approved kontrolü yapar; reddedilirse None döner
        # Predictor % olarak döndürür (örn: 12.0 = %12); biz ondalığa çeviririz
        if raw_result["interest_rate"] is not None:
            est_rate = round(raw_result["interest_rate"] / 100, 4)
            est_rate_pct = f"%{raw_result['interest_rate']:.1f}"
        else:
            est_rate = None
            est_rate_pct = None

        # ── 5. Counterfactual (sadece rejected) ───────────────────────
        if not approved:
            dice_raw = ml_loader.dice.generate_counterfactuals(model_input)
            # DiceExplainer → [{"changes": {"LoanAmount": {"from": X, "to": Y}}}]
            counterfactuals = [
                Counterfactual(changes=cf["changes"])
                for cf in dice_raw
                if cf.get("changes")
            ]
        else:
            counterfactuals = []

        # ── 6. Response ───────────────────────────────────────────────
        return CreditAnalyzeResponse(
            risk_score=round(risk_score, 4),
            approval_probability=approval_probability,
            approved=approved,
            approval_band=approval_band,
            optimal_threshold=ml_loader.predictor.threshold,
            estimated_interest_rate=est_rate,
            estimated_interest_rate_pct=est_rate_pct,
            is_anomaly=is_anomaly,
            shap_factors=shap_factors,
            counterfactuals=counterfactuals,
            model_version=ml_loader.model_version,
            summary=_build_summary(approved, approval_probability, approval_band),
        )

    except AppException:
        raise
    except Exception as e:
        raise AppException(500, f"Kredi analizi sırasında hata: {str(e)}", CREDIT_ML_ERROR) from e
