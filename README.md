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
Veri seti boyutu nedeniyle Git'e dahil edilmemiştir. Aşağıdaki Google Drive linkinden indirip `data/raw/` klasörüne yerleştirin:

> 📥 **[Google Drive — Loan_default.csv](https://drive.google.com/file/d/13g8m5i0QaeabfaASYvF-NQQUZs8yGqAB/view?usp=sharing)**

```bash
# Dosya şu konumda olmalı:
data/raw/Loan_default.csv
```

### 5. Ortam değişkenleri (isteğe bağlı)
```bash
cp .env.example .env
# .env dosyasını düzenleyin
```

---

## 🛠️ Kullanım

### Jupyter Notebook'lar
```bash
jupyter notebook
# notebooks/ klasöründeki notebook'ları sırasıyla çalıştırın
```

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

## 👥 Ekip

| Rol | Görev |
|-----|-------|
| Veri Mühendisi & DevOps | Repo yapısı, EDA, veri temizleme, Docker |
| ML Mühendisi 1 | Anomali tespiti (Isolation Forest), Risk skorlama (XGBoost) |
| ML Mühendisi 2 | Faiz optimizasyonu, SHAP entegrasyonu, Streamlit arayüzü |

---

## 📊 Veri Seti

- **Kaynak:** Loan Default Dataset
- **Boyut:** 255.347 satır × 18 sütun
- **Hedef değişken:** `Default` (0 = Ödedi, 1 = Temerrüt)
- **Sınıf dağılımı:** %88.4 / %11.6 (dengesiz)

---

## 📄 Lisans

Bu proje üniversite ders projesi kapsamında geliştirilmektedir.
