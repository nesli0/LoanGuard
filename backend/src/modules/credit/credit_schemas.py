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
    interest_rate: float = Field(..., gt=0, le=1, description="Talep edilen faiz oranı (0.0–1.0)")

    # Kredi geçmişi
    credit_score: int = Field(..., ge=300, le=850, description="Kredi skoru")
    num_credit_lines: int = Field(..., ge=0, description="Aktif kredi hat sayısı")
    has_mortgage: bool = Field(..., description="İpotekli mülk var mı?")
    has_co_signer: bool = Field(..., description="Kefil var mı?")

    # Opsiyonel override'lar (profil/bütçeden otomatik alınır, göndermek zorunlu değil)
    months_employed: int | None = Field(default=None, ge=0, description="İstihdam süresi (ay)")
    income_override: float | None = Field(default=None, gt=0, description="Aylık gelir override (profil bütçesinden alınır)")


# ── Response ─────────────────────────────────────────────────────────

class ShapFactor(BaseModel):
    feature: str
    value: float
    impact: float        # pozitif = onay yönünde, negatif = red yönünde
    impact_label: str    # "Olumlu" | "Olumsuz"


class Counterfactual(BaseModel):
    changes: dict[str, Any]          # {"CreditScore": 680, "DTIRatio": 0.32}
    new_probability: float
    would_approve: bool


class CreditAnalyzeResponse(BaseModel):
    # Ana sonuç
    approval_probability: float      # 0.0 – 1.0
    approved: bool
    risk_band: str                   # Çok Düşük | Düşük | Orta | Yüksek | Çok Yüksek
    optimal_threshold: float

    # Faiz tahmini
    estimated_interest_rate: float   # Onaylanırsa tahmini faiz
    estimated_interest_rate_pct: str # "8.5%" formatında

    # Anomali
    is_anomaly: bool                 # Tutarsız/sahte veri uyarısı

    # Açıklamalar
    shap_factors: list[ShapFactor]   # Top 5 etki eden feature
    counterfactuals: list[Counterfactual]  # "Şunu yapsan onaylanırdın"

    # Özet mesaj
    summary: str
