# ── Türkçe → İngilizce Mapping (Label Encoder değerleriyle eşleşmeli) ──

EDUCATION_MAP = {
    "ilkokul":      "High School",
    "ortaokul":     "High School",
    "lise":         "High School",
    "önlisans":     "Bachelor's",
    "üniversite":   "Bachelor's",
    "yükseklisans": "Master's",
    "doktora":      "PhD",
}

EMPLOYMENT_MAP = {
    "maaşlı":  "Full-time",
    "yarı":    "Part-time",
    "serbest": "Self-employed",
    "işsiz":   "Unemployed",
    "emekli":  "Part-time",
}

MARITAL_MAP = {
    "bekar":     "Single",
    "evli":      "Married",
    "boşanmış":  "Divorced",
    "dul":       "Divorced",
}

LOAN_PURPOSE_MAP = {
    "ev":      "Home",
    "araç":    "Auto",
    "eğitim":  "Education",
    "iş":      "Business",
    "diğer":   "Other",
    "other":   "Other",
    "home":    "Home",
    "auto":    "Auto",
    "education": "Education",
    "business": "Business",
}

# ── Risk Band Etiketleri ──
RISK_BANDS = [
    ("Çok Düşük",  0.0,  0.2),
    ("Düşük",      0.2,  0.4),
    ("Orta",       0.4,  0.55),
    ("Yüksek",     0.55, 0.7),
    ("Çok Yüksek", 0.7,  1.0),
]

# ── Faiz Oranı Hesabı (interest_rate_metadata.json) ──
BASE_RATE = 0.05
RISK_PREMIUM_MAX = 0.15
MAX_RATE = 0.20

# ── Error Codes ──
CREDIT_PROFILE_INCOMPLETE = "CREDIT_PROFILE_INCOMPLETE"
CREDIT_ML_ERROR = "CREDIT_ML_ERROR"
