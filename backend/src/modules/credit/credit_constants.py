# ── Türkçe → İngilizce Mapping (Label Encoder değerleriyle eşleşmeli) ──

EDUCATION_MAP = {
    "ilkokul":        "High School",
    "ilköğretim":     "High School",
    "ortaokul":       "High School",
    "lise":           "High School",
    "önlisans":       "Bachelor's",
    "lisans":         "Bachelor's",
    "üniversite":     "Bachelor's",
    "yükseklisans":   "Master's",
    "yüksek lisans":  "Master's",
    "doktora":        "PhD",
}

EMPLOYMENT_MAP = {
    "maaşlı":   "Full-time",
    "yarı":     "Part-time",
    "serbest":  "Self-employed",
    "işveren":  "Self-employed",
    "işsiz":    "Unemployed",
    "emekli":   "Part-time",
    "öğrenci":  "Unemployed",
    "ogrenci":  "Unemployed",
}

MARITAL_MAP = {
    "bekar":     "Single",
    "evli":      "Married",
    "boşanmış":  "Divorced",
    "dul":       "Divorced",
}

LOAN_PURPOSE_MAP = {
    "ev":        "Home",
    "araç":      "Auto",
    "eğitim":    "Education",
    "iş":        "Business",
    "diğer":     "Other",
    "other":     "Other",
    "home":      "Home",
    "auto":      "Auto",
    "education": "Education",
    "business":  "Business",
}

# ── Onaylanma Şansı Bantları (approval_probability = 1 - risk_score) ──
APPROVAL_BANDS = [
    ("Çok Düşük Onaylanma Şansı",  0.0,  0.31),
    ("Düşük Onaylanma Şansı",      0.31, 0.51),
    ("Orta Onaylanma Şansı",       0.51, 0.71),
    ("Yüksek Onaylanma Şansı",     0.71, 0.86),
    ("Çok Yüksek Onaylanma Şansı", 0.86, 1.01),
]

# ── Feature Adları Türkçe Mapping (SHAP açıklamaları için) ──
FEATURE_NAMES_TR = {
    "InterestRate":    "Faiz Oranı",
    "LoanAmount":      "Kredi Tutarı",
    "Age":             "Yaş",
    "EmploymentType":  "İstihdam Tipi",
    "LoanPurpose":     "Kredi Amacı",
    "DTIRatio":        "Borç/Gelir Oranı",
    "CreditScore":     "Kredi Skoru",
    "MonthsEmployed":  "Çalışma Süresi (Ay)",
    "NumCreditLines":  "Kredi Hattı Sayısı",
    "HasMortgage":     "İpotek Durumu",
    "HasDependents":   "Bakmakla Yükümlü",
    "HasCoSigner":     "Kefil Durumu",
    "LoanTerm":        "Kredi Vadesi (Ay)",
    "Income":          "Aylık Gelir",
    "LoanToIncome":    "Kredi/Gelir Oranı",
    "PaymentToIncome": "Taksit/Gelir Oranı",
    "CreditAgePerLine":"Kredi Yaşı/Hat",
    "TotalDebtBurden": "Toplam Borç Yükü",
}

# ── Error Codes ──
CREDIT_PROFILE_INCOMPLETE = "CREDIT_PROFILE_INCOMPLETE"
CREDIT_ML_ERROR = "CREDIT_ML_ERROR"
