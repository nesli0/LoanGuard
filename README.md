# LoanGuard 🛡️
## Uçtan Uca Akıllı Kredi Karar Destek Sistemi

Müşteri verisi girildiğinde birbirini takip eden **3 farklı ML modelinden** oluşan bir pipeline ile kredi kararını destekleyen, kararlarını **SHAP** ile açıklayabilen ve **Docker** ile paketlenip canlıya alınabilen tam teşekküllü bir yazılım ürünüdür.

---

## 🏗️ Pipeline Mimarisi

```
Müşteri Verisi → [1. Anomali Tespiti] → [2. Risk Skorlama] → [3. Faiz Optimizasyonu] → Karar Çıktısı
                  (Isolation Forest)     (XGBoost)            (Optimizasyon Modeli)
```

| Aşama | Model | Açıklama |
|-------|-------|----------|
| 1 | Isolation Forest | Şüpheli / anomali başvuruları tespit eder |
| 2 | XGBoost | Kredi temerrüt riskini skorlar |
| 3 | Optimizasyon Modeli | Risk skoruna göre optimal faiz oranını belirler |

---

## 📁 Proje Yapısı

```
LoanGuard/
├── data/                  # Veri dosyaları
│   ├── raw/               # Ham veri (değiştirilmez)
│   ├── processed/         # Temizlenmiş veri (modeller buradan okur)
│   └── external/          # Harici kaynaklar
├── notebooks/             # Jupyter notebook'lar (numaralı sırayla)
├── src/                   # Kaynak kodu (modüler Python paketleri)
│   ├── data/              # Veri yükleme & ön-işleme
│   ├── features/          # Feature engineering
│   ├── models/            # Model tanımları & eğitim
│   ├── pipeline/          # Uçtan uca inference pipeline
│   ├── explainability/    # SHAP açıklanabilirlik
│   └── api/               # FastAPI backend
├── models/                # Eğitilmiş model dosyaları (.joblib)
├── reports/               # Çıktılar & raporlar
│   ├── figures/           # Grafikler (.png)
│   └── metrics/           # Performans metrikleri (.json)
├── configs/               # Konfigürasyon dosyaları
├── tests/                 # Birim & entegrasyon testleri
└── docs/                  # Dokümantasyon
```

> **Not:** Git boş klasörleri takip etmez. `models/` ve `reports/metrics/` gibi klasörlerin GitHub'da görünebilmesi için içlerine `.gitkeep` adlı boş bir dosya eklenmiştir. Bu dosyanın kendisi bir şey yapmaz; sadece klasörün Git tarafından takip edilmesini sağlayan bir sektör konvansiyonudur.

---

## 🚀 Kurulum

### 1. Repo'yu klonlayın
```bash
git clone https://github.com/nesli0/LoanGuard.git
cd LoanGuard
```

### 2. Sanal ortam oluşturun
```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

### 3. Bağımlılıkları yükleyin
```bash
pip install -r requirements.txt
```

### 4. Veri setini indirin
Veri seti boyutu nedeniyle Git'e dahil edilmemiştir. `data/raw/` klasörüne yerleştirin:

```bash
# Dosya şu konumda olmalı:
data/raw/Loan_default.csv
```

Not: `data/processed/` ve `models/` klasörlerindeki dosyalar notebook'lar çalıştırıldığında otomatik oluşur.

---

## 🛠️ Kullanım

### Jupyter Notebook'lar
```bash
jupyter notebook
```

| Notebook | İçerik | Çalıştırılmalı mı? |
|----------|--------|---------------------|
| `01_EDA.ipynb` | Keşifsel veri analizi | ✅ İsteğe bağlı (sadece görselleri görmek için) |
| `02_preprocessing.ipynb` | Veri ön-işleme | ✅ Evet (processed verileri ve pipeline nesnelerini üretir) |
| `03_modeling_*.ipynb` | Model eğitimi | ⚠️ Eğitim uzun sürer — eğitilmiş model Drive'dan indirilebilir |

### API Sunucusu
```bash
uvicorn src.api.main:app --reload
# Swagger UI: http://localhost:8000/docs
```

### Streamlit Arayüzü
```bash
streamlit run src/app.py
```

### Docker ile Çalıştırma
```bash
docker-compose up --build
```

---

## 📦 Model Kaydetme Kuralları

Eğitilen tüm modeller aşağıdaki formatta kaydedilmelidir:

```python
import joblib

# Kaydetme
joblib.dump(model, "models/model_adi.joblib")

# Yükleme
model = joblib.load("models/model_adi.joblib")
```

**İsimlendirme kuralı:** `models/` klasörüne `model_adi.joblib` formatında kaydedin:

| Model | Dosya Adı |
|-------|-----------|
| XGBoost | `models/xgboost_model.joblib` |
| Isolation Forest | `models/isolation_forest.joblib` |
| Diğer modeller | `models/model_adi.joblib` |

> **Not:** `.joblib` dosyaları `.gitignore` ile GitHub'a gitmez. Eğittiğiniz modeli `models/` klasörüne kaydettikten sonra Google Drive'a da yükleyin.

---

## 📊 Veri Seti

- **Kaynak:** Loan Default Dataset
- **Boyut:** 255.347 satır × 18 sütun
- **Hedef değişken:** `Default` (0 = Ödedi, 1 = Temerrüt)
- **Sınıf dağılımı:** %88.4 / %11.6 (dengesiz)
