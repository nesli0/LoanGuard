# LoanGuard — Sistem Mimarisi

## Genel Bakış

LoanGuard, bir AI finansal danışmanlık platformudur. Kullanıcılar kredi uygunluklarını öğrenebilir,
bütçelerini takip edebilir ve AI danışmana sorular sorabilir. Kredi analizi bu büyük sistemin
bir alt modülüdür.

## Katman Mimarisi

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  • Finansal Profil  • Bütçe Takibi  • Kredi Başvurusu  │
│  • Finansal Sağlık Skoru           • AI Chat Arayüzü   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                   FastAPI Backend                        │
│  POST /predict   GET /profile   POST /chat              │
│  • Pydantic şema doğrulama                              │
│  • Supabase (kullanıcı & başvuru verisi)                │
│  • Gemini 1.5 Flash (LLM streaming)                     │
└──────────┬───────────────────────────┬──────────────────┘
           │ Python import             │ Gemini API
┌──────────▼──────────┐    ┌──────────▼──────────────────┐
│   ML Pipeline       │    │   LLM Prompt Template        │
│   (src/ modülleri)  │    │   system: Türk fin. danışman │
└──────────┬──────────┘    │   context: profil + skor +   │
           │               │   shap_top3 + counterfactuals│
           │               └─────────────────────────────-┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                  ML Pipeline Akışı                        │
│                                                           │
│  Ham Başvuru Verisi                                       │
│      │                                                    │
│      ▼  02_preprocessing + 02b_feature_engineering        │
│  [Encode → Rasyolar → Scale]                             │
│      │                                                    │
│      ├──▶ Stage 1: Isolation Forest                       │
│      │    → anomaly_flag (True/False)                    │
│      │                                                    │
│      ├──▶ Stage 2: XGBoost Classifier                    │
│      │    → risk_score [0–1]                             │
│      │    → decision: approved / rejected                │
│      │                                                    │
│      ├──▶ Stage 3: Interest Rate Calculator              │
│      │    → interest_rate [%5–%20]  (sadece approved)    │
│      │                                                    │
│      ├──▶ SHAP (per-request)                             │
│      │    → shap_top3: neden bu karar?                   │
│      │                                                    │
│      └──▶ DiCE-ML (rejected ise)                         │
│           → counterfactuals: ne değişseydi onaylanırdı?  │
│                                                           │
│  Çıktı JSON:                                             │
│  {anomaly_flag, risk_score, decision, interest_rate,     │
│   shap_top3, counterfactuals}                            │
└──────────────────────────────────────────────────────────┘
```

## ML Pipeline Detayları

### Preprocessing (02 + 02b Notebook'ları)

```
Ham veri (17 sütun)
  → LabelEncoder (7 kategorik sütun)        # label_encoders.joblib
  → 4 Finansal Rasyo (annuity formülü)      # src/features/ratios.py (Single Source of Truth)
  → StandardScaler (13 sayısal sütun)       # scaler.joblib
  → 20 özellik (model girişi)
```

### Stage 1 — Anomali Tespiti

- **Model:** Isolation Forest (`isolation_forest.joblib`)
- **Parametre:** contamination=0.05
- **Çıktı:** `anomaly_flag` — test setinin ~%4.94'ü anormal
- **Kullanım:** Sahte/tutarsız başvuruları işaretler, pipeline'ı durdurmaz

### Stage 2 — Risk Skorlama

- **Model:** XGBoost Classifier (`xgboost_risk_model.joblib`)
- **Özellik:** 20 (9 orijinal + 7 kategorik + 4 rasyo)
- **Eğitim:** RandomizedSearchCV (20 iter × 3-fold), SMOTE ile karşılaştırıldı
- **Metrikler:** ROC-AUC=0.7595, Recall=0.705, Precision=0.223
- **Eşik:** 0.4885 (min Recall≥0.70 @ max Precision kriteri)

### Stage 3 — Faiz Oranı

- **Yöntem:** Deterministik lineer formül (`src/pipeline/interest_rate.py`)
- **Formül:** `rate = 5% + 15% × risk_score`
- **Aralık:** %5 (sıfır risk) – %20 (maksimum risk)
- **Eşikte:** risk_score=0.4885 → ~%12.3 faiz

### SHAP (Per-Request)

- **Araç:** `shap.TreeExplainer` (Lazy init ile `src/models/predictor.py` içine entegre)
- **Çıktı:** Top-3 özellik, yön (+/-) ve SHAP değeri
- **Amaç:** "Bu başvuru neden reddedildi?" → LLM prompt'a beslenir

### DiCE-ML Counterfactuals

- **Araç:** DiCE random method (`src/explainability/dice_explainer.py`)
- **Actionable features:** LoanAmount, HasCoSigner, Income
- **Çıktı:** 3 senaryo — her birinde hangi değişiklik onaylatırdı
- **Amaç:** "Ne değişseydi onaylanırdı?" → LLM prompt'a + React UI'ya beslenir

## LLM Entegrasyonu

```
[System Prompt]
Sen bir Türk bankasının finansal danışmanısın. Samimi, anlaşılır dil kullan.

[Bağlam — ML Pipeline çıktısı]
Müşteri profili: {isim}, {gelir}, {kredi talebi}
Risk skoru: {risk_score:.0%} → Karar: {decision}
Faiz oranı: %{interest_rate}
Kararı etkileyen faktörler: {shap_top3}
Alternatif senaryolar: {counterfactuals}

[Kullanıcı sorusu]
{user_question}
```

- **Dev:** Ollama (Llama 3.1 8B, localhost:11434)
- **Prod:** Google Gemini 1.5 Flash API (ücretsiz tier, 15 req/dk)
- **Backend:** Streaming destekli FastAPI endpoint → React chat

## Sorumluluk Sınırları

| Konu | Sahip |
|------|-------|
| ML pipeline (notebook'lar + src/models, src/explainability, src/pipeline) | ML Mühendisi |
| FastAPI route'ları, Pydantic şema | Backend Mühendisi |
| Supabase şema ve sorgular | Backend Mühendisi |
| Gemini API entegrasyonu, LLM streaming | Backend Mühendisi |
| LLM prompt template tasarımı | ML Mühendisi → Backend'e teslim |
| React bileşenleri | Frontend Mühendisi |

## Teslim Edilecekler (ML → Backend)

1. `models/` — `.joblib` ve `xgboost_metadata.json` dosyaları
2. `src/models/predictor.py` — `predict(dict) → dict` API (SHAP dahildir)
3. `src/explainability/dice_explainer.py` — DiCE counterfactual modülü
4. `src/features/ratios.py` — Finansal oranların tekil hesaplama merkezi
5. Input/Output JSON şeması (aşağıda)
6. LLM prompt template

### API Input Şeması

```json
{
  "Age": 35,
  "Income": 75000,
  "LoanAmount": 50000,
  "CreditScore": 650,
  "MonthsEmployed": 48,
  "NumCreditLines": 3,
  "InterestRate": 12.5,
  "LoanTerm": 36,
  "DTIRatio": 0.35,
  "Education": "Bachelor's",
  "EmploymentType": "Full-time",
  "MaritalStatus": "Married",
  "HasMortgage": "No",
  "HasDependents": "Yes",
  "LoanPurpose": "Auto",
  "HasCoSigner": "No"
}
```

### API Output Şeması

```json
{
  "anomaly_flag": false,
  "risk_score": 0.3821,
  "decision": "approved",
  "interest_rate": 10.73,
  "shap_top3": [
    {"feature": "DTIRatio", "direction": "+", "shap_value": 0.182},
    {"feature": "CreditScore", "direction": "-", "shap_value": -0.134},
    {"feature": "LoanToIncome", "direction": "+", "shap_value": 0.097}
  ],
  "counterfactuals": []
}
```
