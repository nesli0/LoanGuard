# LoanGuard

Kredi başvurusu verisini **anomali tespiti → risk skoru → faiz önerisi** sırasıyla işleyen, **SHAP** ile açıklanabilir ve **Docker / API** ile servis edilebilir bir karar destek iskeleti.

## Pipeline (özet)

```
Girdi → Isolation Forest (anomali) → XGBoost (risk) → Faiz / limit optimizasyonu → Çıktı + SHAP
```

## Repo yapısı

```
LoanGuard/
├── data/
│   ├── raw/           # Ham veri (Git’te yalnızca yer tutucu; dosya Drive’dan)
│   ├── processed/     # Eğitim/test split vb. (büyük CSV’ler Git’te değil)
│   └── external/      # Harici tablolar / referanslar (içerik Git’te değil)
├── notebooks/         # EDA, ön-işleme, model denemeleri (çıktıları repo’ya koymayın)
├── src/               # data, features, models, pipeline, explainability, api
├── models/            # Eğitilmiş ağırlıklar (.joblib — Git’te değil, Drive)
├── reports/           # figürler, metrik JSON (isteğe bağlı Git)
├── configs/
├── tests/
└── docs/
```

Boş klasörler için `.gitkeep` kullanılır. **`data/external/.gitkeep`** artık `.gitignore` istisnasıyla repoya dahil edilir (`data/external/*` tüm dosyayı susturduğu için önceden GitHub’a gitmiyordu).

## Google Drive önerilen klasör yapısı

Takımın ortak “kaynak gerçeği” için Drive’da tek kök klasör açıp yerel `LoanGuard/` ile aynı mantığı korumanız yeterli:

```
LoanGuard_Drive/
├── data/
│   ├── raw/
│   │   └── Loan_default.csv
│   ├── processed/
│   │   ├── X_train.csv
│   │   ├── X_test.csv
│   │   ├── y_train.csv
│   │   └── y_test.csv
│   └── external/
│       └── (harici CSV / referans dosyalar)
├── models/
│   ├── isolation_forest.joblib
│   ├── xgboost_model.joblib
│   └── (diğer model dosyaları — kişi başı seçilen modele göre)
├── reports/
│   ├── figures/
│   └── metrics/
└── notebook_outputs/
    ├── 01_EDA/
    ├── 02_preprocessing/
    └── 03_modeling/
```

- **data/** — büyük veri; repo yerine Drive.
- **models/** — eğitilmiş dosyalar; repo `.gitignore` ile dışarıda.
- **notebook_outputs/** — notebook’ları kim çalıştırırsa ürettiği HTML, PNG, CSV özetleri buraya; repoya commit etmeyin, Drive linki veya kısa not yeterli.

## Kurulum (geliştirici)

```bash
git clone https://github.com/nesli0/LoanGuard.git
cd LoanGuard
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Ham veriyi Drive’dan indirip `data/raw/Loan_default.csv` konumuna koyun (veya takımın agreed path’ine). İşlenmiş veri ve modeller yoksa, bunları notebook veya script’lerle üretip **Drive’daki** `data/processed/` ve `models/` ile senkron tutun.

## API ve arayüz

```bash
uvicorn src.api.main:app --reload   # http://localhost:8000/docs
streamlit run src/app.py
docker-compose up --build
```

## Takım çalışması (yarın ve sonrası)

Şu an `main` doğrudan kullanılabilir; ekip büyüyünce öneri:

- Her kişi **bir model / bir dikey** için `feature/<kısa-isim>` dalı açsın (ör. `feature/xgboost-risk`, `feature/isolation-forest`).
- `.joblib` ve büyük CSV’leri **yalnızca Drive**’da tutun; PR’larda kod + küçük config değişikliği.
- Model dosya adları için tek sözlük kullanın (ör. `models/xgboost_model.joblib`, `models/isolation_forest.joblib`); yeni model ekleyen Drive’a ve bu README’deki Drive ağacına aynı isimle koysun.

## Veri seti (özet)

- **Loan default** verisi; hedef: `Default`. Sınıf dengesiz (~%88 / ~%12). Detay ve lisans bilgisi için proje içi `docs/` veya notebook notlarına bakın.
