# LoanGuard

Kredi başvurusu verisini **anomali tespiti → risk skoru → faiz önerisi** sırasıyla işleyen, **SHAP** ile açıklanabilir ve **Docker / API** ile servis edilebilir bir karar destek iskeleti.

## Pipeline (özet)

```
Girdi → Isolation Forest (anomali) → XGBoost (risk) → Faiz / limit optimizasyonu → Çıktı + SHAP
```

## Proje Yapısı

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

Notebook'ları **herkesin sıfırdan çalıştırması gerekmez**. Takımla paylaştığınız **Google Drive** linkinden ham veri, işlenmiş veriler, eğitilmiş modeller ve rapor/figür dosyalarını indirip bu yapıdaki ilgili klasörlere koymanız yeterlidir. Böylece herkesin notebook'u yeniden çalıştırıp aynı grafikleri üretmesi ve dosyaları tekrar yüklemesi gerekmez. Notebook'ları yalnızca akışı incelemek veya kendi denemenizi yapmak için kullanabilirsiniz.

## Kurulum

1. Repo'yu klonlayın

```bash
git clone https://github.com/nesli0/LoanGuard.git
cd LoanGuard
```

2. Sanal ortam oluşturun

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

3. Bağımlılıkları yükleyin

```bash
pip install -r requirements.txt
```
