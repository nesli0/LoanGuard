# ML → Backend Handoff Dokümanı

Bu doküman, ML pipeline'ının FastAPI backend'e nasıl entegre edileceğini açıklar.  
ML mühendisinin ürettiği çıktılar, beklenen davranışlar ve dikkat edilmesi gereken noktalar burada.

---

## 1. Teslim Edilen Dosyalar

```
models/
├── label_encoders.joblib       # 7 kategorik sütun için LabelEncoder dict
├── scaler.joblib               # 13 sayısal sütun için StandardScaler
├── xgboost_risk_model.joblib   # Kredi temerrüt sınıflandırıcısı
├── xgboost_metadata.json       # threshold, feature listesi, model versiyonu
└── isolation_forest.joblib     # Anomali dedektörü

src/
├── pipeline/
│   └── interest_rate.py        # compute_interest_rate(risk_score) → float
├── models/
│   └── predictor.py            # LoanGuardPredictor — ana inference sınıfı
└── explainability/
    ├── shap_explainer.py       # SHAPExplainer — neden bu karar?
    └── dice_explainer.py       # DiceExplainer — ne değişseydi onaylanırdı?
```

**Preprocessing'i kendin yapma.** `LoanGuardPredictor.predict()` encode, rasyo hesaplama ve
ölçeklemeyi içten hallediyor. Ham veriyi ver, sonucu al.

---

## 2. Kurulum

```bash
pip install -r requirements.txt   # dice-ml, shap, xgboost, joblib dahil
```

`models/` klasörünü uygulamanın çalışma dizinine göre erişilebilir yere koy.
Varsayılan yol: proje kökündeki `models/` (predictor.py otomatik buluyor).

---

## 3. Startup — Modelleri Bir Kez Yükle

**Kritik:** `LoanGuardPredictor()` ve `DiceExplainer()` init edildiğinde 4 joblib
dosyası diskten okunuyor. Bunu her request'te yapma — uygulama başlarken bir kez yap.

```python
# src/api/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from src.models.predictor import LoanGuardPredictor
from src.explainability.dice_explainer import DiceExplainer

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.predictor = LoanGuardPredictor()
    app.state.dice = DiceExplainer()          # background data yükler (~5k satır)
    yield

app = FastAPI(lifespan=lifespan)
```

`DiceExplainer` ayrıca `data/interim/loans_cleaned.csv` dosyasını yüklüyor.
Bu dosya production'da olmayabilir — yoksa `DiceExplainer()`'ı başlatırken
`FileNotFoundError` alırsın. Şimdilik sadece rejected başvurularda opsiyonel
tutabilirsin ya da benden bir `dice_background.csv` dosyası iste (models/ içine koyarız).

---

## 4. Predict Endpoint — Input / Output

### Input Şeması

```python
from pydantic import BaseModel
from typing import Literal

class ApplicantSchema(BaseModel):
    # Sayısal alanlar
    Age: int
    Income: int
    LoanAmount: int
    CreditScore: int
    MonthsEmployed: int
    NumCreditLines: int
    InterestRate: float        # başvurudaki faiz oranı (input feature)
    LoanTerm: int              # ay cinsinden: 12, 24, 36, 48, 60
    DTIRatio: float            # 0.0 – 1.0 arası

    # Kategorik alanlar — tam bu string değerleri kabul edilir
    Education: Literal["Bachelor's", "High School", "Master's", "PhD"]
    EmploymentType: Literal["Full-time", "Part-time", "Self-employed", "Unemployed"]
    MaritalStatus: Literal["Divorced", "Married", "Single"]
    HasMortgage: Literal["No", "Yes"]
    HasDependents: Literal["No", "Yes"]
    LoanPurpose: Literal["Auto", "Business", "Education", "Home", "Other"]
    HasCoSigner: Literal["No", "Yes"]
```

> **Not:** `InterestRate` başvurunun mevcut faiz oranıdır (model feature'ı).
> ML'in hesapladığı `interest_rate` ise output'ta ayrı bir alandır.

### Output Şeması

```python
@app.post("/predict")
def predict(body: ApplicantSchema, request: Request):
    result = request.app.state.predictor.predict(body.model_dump())

    # Sadece reddedilen başvurularda counterfactual üret
    if result["decision"] == "rejected":
        result["counterfactuals"] = request.app.state.dice.generate_counterfactuals(
            body.model_dump()
        )

    return result
```

```json
{
  "anomaly_flag": false,
  "risk_score": 0.6821,
  "decision": "rejected",
  "interest_rate": null,
  "shap_top3": [
    {"feature": "DTIRatio",      "direction": "+", "shap_value": 0.2134},
    {"feature": "CreditScore",   "direction": "-", "shap_value": -0.1587},
    {"feature": "LoanToIncome",  "direction": "+", "shap_value": 0.1102}
  ],
  "counterfactuals": [
    {"changes": {"LoanAmount": {"from": 95000, "to": 61000}}},
    {"changes": {"HasCoSigner": {"from": "No", "to": "Yes"}}},
    {"changes": {"LoanAmount": {"from": 95000, "to": 70000}, "Income": {"from": 42000, "to": 55000}}}
  ]
}
```

### Output Alanlarının Anlamı

| Alan | Tip | Açıklama |
|------|-----|----------|
| `anomaly_flag` | bool | `true` = olağandışı başvuru (sahte/tutarsız olabilir). Pipeline devam eder ama ön yüzde uyarı göster. |
| `risk_score` | float 0–1 | Temerrüt olasılığı. 0=hiç risk yok, 1=kesin temerrüt. |
| `decision` | string | `"approved"` veya `"rejected"`. Eşik: 0.4885 (metadata'da). |
| `interest_rate` | float veya null | Onaylıysa önerilen yıllık faiz (%). Reddedildiyse `null`. |
| `shap_top3` | list | Kararı en çok etkileyen 3 özellik. `"+"` = riski artırdı, `"-"` = riski azalttı. |
| `counterfactuals` | list | Reddedilen başvuru için "ne değişseydi onaylanırdı" senaryoları. Onaylıysa boş liste. |

---

## 5. LLM Prompt Template

AI danışman chat'i için prompt yapısı. Sen değişkenleri doldurursun, LLM geri kalanı yapar.

```python
def build_llm_prompt(user_profile: dict, ml_result: dict, user_question: str) -> dict:
    """
    user_profile: Supabase'den gelen kullanıcı bilgileri (isim, yaş, gelir vb.)
    ml_result: predictor.predict() çıktısı
    user_question: Kullanıcının chat'te yazdığı soru
    """

    # SHAP açıklamasını okunabilir metne çevir
    shap_lines = []
    direction_map = {"+": "riski artırdı", "-": "riski azalttı"}
    for item in ml_result["shap_top3"]:
        shap_lines.append(
            f"- {item['feature']}: {direction_map[item['direction']]}"
        )
    shap_text = "\n".join(shap_lines)

    # Counterfactual açıklaması
    cf_lines = []
    for i, cf in enumerate(ml_result.get("counterfactuals", []), 1):
        parts = []
        for feat, change in cf["changes"].items():
            parts.append(f"{feat}: {change['from']} → {change['to']}")
        cf_lines.append(f"Senaryo {i}: {', '.join(parts)}")
    cf_text = "\n".join(cf_lines) if cf_lines else "Bilgi yok."

    decision_tr = "ONAYLI" if ml_result["decision"] == "approved" else "REDDEDİLDİ"
    rate_text = (
        f"%{ml_result['interest_rate']:.1f} faiz oranı önerildi"
        if ml_result["interest_rate"]
        else "faiz hesaplanmadı"
    )
    anomaly_text = (
        " ⚠️ Başvuru olağandışı işaretlendi." if ml_result["anomaly_flag"] else ""
    )

    system_message = (
        "Sen deneyimli bir Türk bankacısısın. Müşteriye finansal konularda "
        "samimi, anlaşılır ve destekleyici bir dille yardım et. "
        "Teknik terimlerden kaçın, somut öneriler ver."
    )

    context = f"""Müşteri Bilgileri:
- İsim: {user_profile.get('name', 'Müşteri')}
- Yaş: {user_profile.get('age')}, Gelir: {user_profile.get('income')} TL

Kredi Başvurusu Sonucu: {decision_tr}{anomaly_text}
Risk Skoru: %{ml_result['risk_score'] * 100:.0f} — {rate_text}

Kararı etkileyen başlıca faktörler:
{shap_text}

Başvuruyu onaylatabilecek değişiklikler:
{cf_text}"""

    return {
        "system": system_message,
        "context": context,
        "question": user_question,
    }
```

### Gemini API Entegrasyonu

```python
import google.generativeai as genai

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-1.5-flash")

def stream_llm_response(prompt_data: dict):
    full_prompt = (
        f"{prompt_data['context']}\n\n"
        f"Kullanıcı sorusu: {prompt_data['question']}"
    )
    response = model.generate_content(
        full_prompt,
        system_instruction=prompt_data["system"],
        stream=True,
    )
    for chunk in response:
        yield chunk.text
```

---

## 6. Model Versiyonu

```python
import json
with open("models/xgboost_metadata.json") as f:
    meta = json.load(f)

print(meta["model_version"])      # "1.0.0"
print(meta["optimal_threshold"])  # 0.4885
print(meta["trained_at"])         # "2026-04-25T11:04:17..."
```

Yeni model geldiğinde bu dosya güncellenecek. Response'a eklemek istersen:

```json
{ "model_version": "1.0.0", "decision": "rejected", ... }
```

---

## 7. Dikkat Edilmesi Gerekenler

**Yapma:**
- Her request'te `LoanGuardPredictor()` veya `DiceExplainer()` çağırma — startup'ta bir kez yap.
- Ham input'u preprocessing yapmadan modele verme — zaten predictor içinde hallediliyor.
- `InterestRate` input field'ını modelin ürettiği `interest_rate` output'uyla karıştırma (farklı şeyler).

**Yap:**
- `anomaly_flag == True` ise frontend'de kullanıcıya uyarı göster ("Başvurunuzda tutarsızlık tespit edildi").
- DiCE counterfactual'ları sadece `decision == "rejected"` ise üret — approved için gereksiz.
- `interest_rate` null kontrolü yap — rejected başvurularda null gelir.
- LLM prompt'a `shap_top3` ve `counterfactuals` her ikisini de besle — birlikte daha iyi yanıt üretiyor.

---

## 8. Hızlı Test

Backend'i ayağa kaldırmadan ML pipeline'ının çalıştığını test etmek için:

```python
from src.models.predictor import LoanGuardPredictor

predictor = LoanGuardPredictor()

test_input = {
    "Age": 35, "Income": 75000, "LoanAmount": 50000, "CreditScore": 650,
    "MonthsEmployed": 48, "NumCreditLines": 3, "InterestRate": 12.5,
    "LoanTerm": 36, "DTIRatio": 0.35,
    "Education": "Bachelor's", "EmploymentType": "Full-time",
    "MaritalStatus": "Married", "HasMortgage": "No",
    "HasDependents": "Yes", "LoanPurpose": "Auto", "HasCoSigner": "No",
}

result = predictor.predict(test_input)
print(result)
# → anomaly_flag, risk_score, decision, interest_rate, shap_top3, counterfactuals
```

Çalışırsa ML tarafı hazır, entegrasyon başlayabilir.
