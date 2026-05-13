from typing import Any

from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────

class CreditAnalyzeRequest(BaseModel):
    """
    Kullanıcının kredi analizi için gönderdiği veri.
    Profil/bütçe'den otomatik doldurulan alanlar servis katmanında eklenir.
    """
    # Kredi bilgileri
    loan_amount: float = Field(..., gt=0, description="Talep edilen kredi tutarı (TL)")
    loan_term: int = Field(..., ge=6, le=360, description="Kredi vadesi (ay)")
    loan_purpose: str = Field(..., description="ev | araç | eğitim | iş | diğer")
    # Ondalık format (0.0–1.0); backend modele % formatında iletir (×100)
    interest_rate: float = Field(..., gt=0, le=1, description="Yıllık faiz oranı (0.0–1.0, örn: 0.125 = %12.5)")

    # Kredi geçmişi
    credit_score: int = Field(..., ge=300, le=850, description="Kredi skoru")
    num_credit_lines: int = Field(..., ge=0, description="Aktif kredi hat sayısı")
    has_mortgage: bool = Field(..., description="İpotekli mülk var mı?")
    has_co_signer: bool = Field(..., description="Kefil var mı?")

    # Opsiyonel override'lar (profil/bütçeden otomatik alınır)
    months_employed: int | None = Field(default=None, ge=0, description="İstihdam süresi (ay)")
    income_override: float | None = Field(default=None, gt=0, description="Aylık gelir override (TL)")


# ── Response ─────────────────────────────────────────────────────────

class ShapFactor(BaseModel):
    """En etkili feature'lardan biri için SHAP açıklaması."""
    feature: str          # İngilizce teknik ad (örn: "DTIRatio")
    feature_tr: str       # Türkçe ad (örn: "Borç/Gelir Oranı")
    direction: str        # "+" = riski artırdı (olumsuz), "-" = riski azalttı (olumlu)
    shap_value: float     # SHAP ağırlığı (mutlak değer büyüklüğü = etki)
    impact_label: str     # "Olumsuz" | "Olumlu"


class Counterfactual(BaseModel):
    """
    DiCE-ML counterfactual senaryosu.
    Ne değişseydi başvuru onaylanırdı?
    """
    changes: dict[str, Any]
    # Örn: {"LoanAmount": {"from": 95000, "to": 61000},
    #        "HasCoSigner": {"from": "No", "to": "Yes"}}


class CreditAnalyzeResponse(BaseModel):
    analysis_id: str | None = None
    # ── Ana Sonuç ─────────────────────────────────────────────────────
    risk_score: float           # XGBoost çıktısı — temerrüt olasılığı (0=güvenli, 1=riskli)
    approval_probability: float # 1 - risk_score — onaylanma ihtimali
    approved: bool
    approval_band: str          # "Çok Düşük Onaylanma Şansı" vb.
    optimal_threshold: float    # Karar eşiği (metadata'dan)

    # ── Faiz Tahmini (sadece approved) ───────────────────────────────
    estimated_interest_rate: float | None      # Ondalık (örn: 0.12)
    estimated_interest_rate_pct: str | None    # "%12.0" formatında

    # ── Anomali ──────────────────────────────────────────────────────
    is_anomaly: bool    # True = olağandışı/tutarsız başvuru

    # ── SHAP Açıklaması (Top 3) ───────────────────────────────────────
    shap_factors: list[ShapFactor]

    # ── Counterfactual (sadece rejected) ─────────────────────────────
    counterfactuals: list[Counterfactual]

    # ── Meta ──────────────────────────────────────────────────────────
    model_version: str
    summary: str


class CreditExplainRequest(BaseModel):
    analysis_id: str

class CreditExplainResponse(BaseModel):
    explanation: str
