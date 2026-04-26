# LoanGuard — Notebook'ların Teknik Açıklaması

Bu belge, LoanGuard ML pipeline'ındaki 7 notebook'un amacını, kodun ne yaptığını, çıktılardan ne anlaşılması gerektiğini ve kullanılan teknolojilerin neden seçildiğini açıklar. Amaç: notebook'ları dışarıdan okuyan birinin tüm bağlantıları görmesi.

---

## Büyük Resim: Pipeline Nereye Gidiyor?

```
01_EDA               → veriyi tanı, soruları sor
02_preprocessing     → ham CSV'yi temizle + encode et  →  loans_cleaned.csv
02b_feature_eng.     → rasyolar + split + scale        →  X_train/X_test/y + scaler.joblib
03_xgboost           → risk modeli eğit + eşik optimizasyonu  →  xgboost_risk_model.joblib
04_isolation_forest  → anomali dedektörü eğit          →  isolation_forest.joblib
05_interest_rate     → risk_score → faiz oranı formülü →  interest_rate.py
06_dice              → reddedilen başvurular için "ne değişseydi?" senaryoları → DiceExplainer
```

Her notebook bir öncekinin çıktısını alır. Sırayı bozarsan eksik dosya hatası alırsın.

---

## 01_EDA.ipynb — Veriyi Tanı

### Ne yapıyor?
255.347 satır, 17 sütunluk kredi başvurusu verisini keşfeder. Sayısal değişkenlerin dağılımına bakar, kategorik değişkenlerin frekansını inceler, hedef değişken (`Default`) ile korelasyonları ölçer, görselleştirmeler üretir.

### Neden önemli?
Model geliştirmeden önce verinin doğasını anlamak zorundasın. EDA'da şu sorular yanıtlanır:
- Kaç tane eksik değer var? (→ 0, veri temiz)
- Hedef sınıf dengesiz mi? (→ Evet, %11.6 temerrüt — bu sonraki her kararda belirleyici)
- Hangi değişkenler hedefle en çok ilişkili? (→ CreditScore, DTIRatio, Income alanları öne çıkıyor)

### Çıktılardan ne anlaşılmalı?
- **%88.4 ödeme / %11.6 temerrüt:** Bu dengesizlik modelin saf çoğunluk sınıfını tahmin etme eğilimini doğurur. Buna karşı önlem alınmayacaksa model neredeyse her başvuruyu onaylar ve yine de %88 doğruluk gösterir — ama hiçbir temerrüdü yakalayamaz. Bu yüzden ilerleyen aşamalarda `scale_pos_weight` ve threshold optimizasyonu devreye girer.
- **LoanID sütunu:** Kimlik alanı — modele beslenirse gerçek bir pattern olmadığı halde ezber yapar (data leakage). EDA'da tespit edilip 02'de kaldırılır.

### Teknoloji seçimi
- **pandas + matplotlib + seaborn:** Veri analizi için endüstri standardı. Alternatif yok.

---

## 02_preprocessing.ipynb — Ham Veriyi Temizle

### Ne yapıyor?
Ham CSV'den (`data/raw/Loan_default.csv`) temizlenmiş veri üretir. Üç adım:
1. `LoanID` sütununu kaldırır
2. 7 kategorik sütunu LabelEncoder ile sayıya çevirir
3. `loans_cleaned.csv` + `label_encoders.joblib` kaydeder

> **Neden IQR kodu yok?** Finans verilerinde uç değerler (istisnai yüksek gelir, çok düşük kredi skoru vb.) **gerçek ve anlamlı** sinyallerdir. IQR kırpma bu bilgiyi yok eder. Outlier tespiti EDA'da (analiz amaçlı) yapılmış, kırpma ölcü münasip görülmediği için pipeline'a eklenmedi.

### LabelEncoder nedir, neden bu?
`Education: ["Bachelor's", "High School", "Master's", "PhD"]` gibi string değerleri XGBoost sayı ister. LabelEncoder her benzersiz değeri bir tamsayıya eşler: `Bachelor's → 0, High School → 1, Master's → 2, PhD → 3`.

**Neden OneHotEncoder değil?**  
OneHotEncoder her kategorik değer için yeni bir sütun açar. 7 sütun × ortalama 4-5 kategori = ~30 ek sütun. XGBoost ağaç tabanlı bir model olduğu için bu kodlamaya ihtiyaç duymaz — hangi sayının hangi dalı temsil ettiğini ağaç yapısından öğrenir. LabelEncoder daha az sütun, daha hızlı eğitim.

**Kritik:** LabelEncoder `label_encoders.joblib` olarak kaydediliyor. API'ye gerçek bir başvuru geldiğinde aynı encoder kullanılmazsa `"Full-time"` farklı bir sayıya encode edilebilir ve model yanlış tahmin üretir. Bu nesneyi kaydetmek zorunlu.

### Çıktılardan ne anlaşılmalı?
```
Doğrulama Sonuçları:
   Boyut          : (255347, 17) → ✅
   Eksik değer    : 0 → ✅
   String sütun   : 0 → ✅
```
Tüm sütunlar artık sayısal. Veri bölünmeden kaydediliyor — train/test ayrımı henüz yapılmıyor çünkü bir sonraki notebook bunu yapacak.

---

## 02b_feature_engineering.ipynb — Yeni Özellikler Türet + Böl + Ölçeklendir

### Ne yapıyor?
Bu notebook pipeline'ın en kritik adımı. Üç iş yapıyor:

**1. Finansal rasyo hesaplama (4 yeni özellik)**

| Rasyo | Formül | Ne anlatıyor? |
|-------|--------|---------------|
| `LoanToIncome` | LoanAmount / Income | Yıllık gelirine göre ne kadar borç alıyorsun? |
| `PaymentToIncome` | aylık_ödeme / (Income/12) | Aylık taksit aylık gelirinin kaçta kaçı? |
| `CreditAgePerLine` | MonthsEmployed / (NumCreditLines+1) | Her kredi hattı başına kaç ay çalışma? |
| `TotalDebtBurden` | (aylık_ödeme × vade) / Income | Toplam geri ödeme yıllık gelire oranla ne kadar? |

**Aylık ödeme neden formülle hesaplanıyor?**  
Eşit taksitli kredi (annuity) formülü:  
`PMT = P × r / (1 - (1+r)^(-n))`  
`P` = anapara, `r` = aylık faiz oranı, `n` = vade (ay). Faiz sıfırsa `PMT = P/n`.

Bu rasyolar ham özelliklerden türetildiği için "domain knowledge" (finans bilgisi) içeriyor. Modele `LoanAmount=100000` ve `Income=30000` verirsen model ikisini ayrı ayrı öğrenir. Ama `LoanToIncome=3.33` verirsen model doğrudan "3 yıllık gelirinin üstünde borç" ilişkisini görür. Daha bilgilendirici.

**Neden split öncesi hesaplanıyor?**  
Bu rasyolar her satır kendi içinde hesaplanıyor — farklı satırların bilgisini kullanmıyor. Bu yüzden split öncesi hesaplamak güvenli. Scaler ise tüm verideki ortalama/std'yi öğrendiği için split sonrası uygulanmalı.

**2. Stratified Train/Test Split (%80/%20)**

```python
train_test_split(X, y, test_size=0.2, stratify=y)
```

`stratify=y`: Her iki sette de temerrüt oranı %11.6 olarak korunur. Bunu yapmazsan şansla train'e çok fazla temerrüt, test'e az düşebilir — model yanıltıcı iyi görünür.

**3. StandardScaler ile ölçeklendirme**

```
✅ scaler.fit(X_train) → transform(X_test)
❌ scaler.fit(X_tümü) → sonra split et
```

Scaler "mean ve std nedir?" diye sorar. Eğer tüm veri üzerinde fit edersen test verisinin istatistikleri de öğrenilmiş olur — bu data leakage'dır. Notebook bunu açıkça yazmış ve doğru uygulamış.

**Not:** XGBoost ağaç tabanlı bir model ve ölçeklemeye matematiksel olarak duyarsızdır. `Age=35` vs `Age=0.2` (scaled) ağacın dallanma kararını değiştirmez. Scaler yine de uygulanıyor çünkü: pipeline tutarlılığı (ileride lineer model eklenirse hazır), ve DiCE counterfactual'ların daha iyi çalışması.

### Çıktılardan ne anlaşılmalı?
```
X_train: (204277, 20) | X_test: (51070, 20)
Scaler fit edilen sütunlar: 13 (9 orijinal + 4 rasyo)
```
20 özellik: 9 orijinal sayısal + 7 kategorik (label-encoded) + 4 rasyo.

---

## 03_xgboost_risk_model.ipynb — Risk Sınıflandırıcısı

### Ne yapıyor?
LoanGuard'ın kalbi. XGBoost modelini eğitir, optimize eder, değerlendirir, kaydeder.

### XGBoost nedir?

**Gradient Boosting** prensibi: bir zayıf öğrenici (karar ağacı) eğit, hatalı tahmin ettiği örnekleri ağırlıklandır, yeni bir ağaç bu hatalara odaklanarak eğit, bu işlemi yüzlerce kez tekrarla. Son tahmin tüm ağaçların ağırlıklı toplamı.

**XGBoost (eXtreme Gradient Boosting)** bu fikrin üzerine şunları ekler:
- `hist` ağaç yapısı → GPU uyumlu, çok hızlı
- `early_stopping` → doğrulama seti AUC'si düşmeye başlayınca dur (overfit önleme)
- `scale_pos_weight=7.6` → 1 temerrüt örneğini 7.6 ödeme örneğine denk sayar (imbalance düzeltmesi)
- L1/L2 regularization → overfit önleme

**Neden XGBoost?**  
Tabular data için Kaggle yarışmalarının uzun süredir birincisi. Yorumlanabilir (SHAP uyumlu), hızlı, regularization mekanizmaları var. Random Forest'tan genellikle daha iyi AUC verir.

### Eğitim süreci

**Adım 1 — Baseline model:** `configs/model_params.yaml`'daki parametrelerle eğit. Validation AUC: 0.74.

**Adım 2 — RandomizedSearchCV:** 20 rastgele parametre kombinasyonu × 3-fold CV = 60 model eğitimi. Skor: CV AUC.

```
Neden GridSearchCV değil?
GridSearchCV tüm kombinasyonları dener: 5 parametre × 4 değer = 1024 model
RandomizedSearchCV 20 rastgele dener: yeterince iyi, çok daha hızlı
```

**Adım 3 — Final model:** En iyi parametrelerle eğit + early stopping.

**Adım 4 — Threshold optimizasyonu:** Kritik adım.

### Threshold optimizasyonu neden önemli?

Modelin `predict_proba()` çıktısı `risk_score` (0-1). Bunu "onay/red" kararına çevirmek için bir eşik lazım.

Varsayılan eşik 0.5. Ama:
- Eşik = 0.5 → Recall=0.49 (temerrütlerin yarısını kaçırıyor), Precision=0.34
- Eşik = 0.4885 → Recall=0.705 (hedef: %70), Precision=0.223

Bankacılıkta **Recall daha değerlidir:** Yanlışlıkla onayladığın bir temerrüt kredisi, yanlışlıkla reddettiğin iyi müşteriden çok daha pahalıya mal olur.

İş gereksinimi: "Minimum %70 temerrüt yakalama oranı." Threshold bu gereksinime göre belirlendi.

### Metrikler

| Metrik | Değer | Ne anlatiyor? |
|--------|-------|---------------|
| ROC-AUC | 0.7595 | Modelin temerrüt/ödeme ayırt etme yeteneği. 0.5=rastgele, 1.0=mükemmel |
| PR-AUC | 0.3336 | İmbalanced veri için daha güvenilir. Precision-Recall dengesi |
| Recall (optimal eşikte) | 0.705 | Gerçek temerrütlerin %70.5'ini yakalıyor |
| Precision (optimal eşikte) | 0.223 | "Temerrüt" dediğimizin %22.3'ü gerçekten temerrüt |

**Precision 0.22 neden bu kadar düşük?**  
Çünkü gerçek temerrüt oranı %11.6. Model eşiği düşürünce daha fazla temerrüt yakalıyor ama aynı zamanda daha fazla iyi müşteriyi de "temerrüt" olarak etiketliyor. Bu bir precision-recall trade-off. `scale_pos_weight=7.6` modeli temerrüt tahminine doğru bastırıyor.

### SMOTE

**Problem:** 7.6:1 dengesizlik → model "herkese ödeyecek de" derse %88 doğruluk elde eder ama işe yaramaz.

**SMOTE (Synthetic Minority Oversampling):** Gerçek temerrüt örneklerinin özelliklerini alır, komşu örneklerle karıştırarak yeni yapay temerrüt örnekleri üretir. Train seti 7.6:1'den 2:1'e gelir.

**Önemli:** SMOTE sadece eğitim setine uygulanır. Test seti asla dokunulmaz — gerçek dünyadaki dağılımı yansıtmalı.

### SHAP (development-time)

Bu notebook'taki SHAP global analiz içindir: "Model genel olarak ne öğrendi?"

Beeswarm grafiği: Her nokta bir örnek. X ekseni SHAP değeri (sıfırdan ne kadar uzak → o özellik o kadar etkili). Renk: özellik değeri yüksek mi düşük mü?

En önemli özellikler (Gain'e göre):
1. `Age` — en bilgilendirici özellik
2. `TotalDebtBurden` — türetilmiş rasyo, ham veriden daha güçlü sinyal
3. `InterestRate` — başvuruda istenen faiz oranı
4. `CreditAgePerLine`, `LoanToIncome` — diğer rasyolar da üst sıralarda

**Bu ne anlama geliyor?** Türetilmiş rasyoların (`TotalDebtBurden` #2 sırada) ham özelliklerden daha güçlü sinyal verdiği görülüyor — feature engineering başarılı.

---

## 04_isolation_forest.ipynb — Anomali Dedektörü

### Ne yapıyor?
XGBoost'tan önce çalışan Stage 1 modeli. Veri içindeki "normal olmayan" başvuruları tespit eder.

### Isolation Forest nedir?

Fikri şu: normal bir veri noktasını izole etmek (tek başına bir ağaç dalında bırakmak) için çok sayıda bölme gerekir. Anormal (aykırı) bir nokta çok hızlı izole edilir.

Algoritma rastgele bölmeler yapan karar ağaçları oluşturur. Bir örneğin "izolasyon derinliği" ne kadar azsa, o örnek o kadar anormaldir.

**`contamination=0.05`:** Verinin %5'inin anormal olduğunu varsayıyoruz. Bu parametre eşiği belirler.

**Neden unsupervised?** Hangi başvuruların "sahte" veya "tutarsız" olduğunu bilmiyoruz — etiket yok. Dolayısıyla supervised öğrenme yapamayız. IF etiket kullanmadan sadece veri yapısından anomali çıkarır.

### Çıktılardan ne anlaşılmalı?

```
Test setinin ~%4.94'ü anormal işaretlendi (contamination=0.05)
```

`contamination=0.05` ile `~%5` işaretlenmesi bekleniyor — **tutarlı, doğru çalışıyor.**

#### IF iki çıktı üretir — ikisini de anlamak zorundasın:

**1. `predict()` → -1 veya +1**  
Doğrudan yorumlama için. `-1 = anormal`, `+1 = normal`.  
Yani `-1` gördüğünde başvuru şüpheli demek.

**2. `score_samples()` → negatif ondalık sayılar (örn. `-0.45`, `-0.61`)**  
Daha ince bir ölçek. Yorumlama:
- Bu değerler **her zaman negatiftir**
- **Daha küçük (daha negatif) = daha anormal**: `-0.7` gören bir başvuru, `-0.3` görenden çok daha şüpheli
- **0'a yakın = çok normal**: `-0.05` neredeyse kesinlikle normaldir
- Eşik değer (`anomaly_threshold = -0.577`): Bu değerin **altında** kalan her örnek `predict()` tarafından `-1` (anormal) olarak etiketlenir

**Örnek okuma:**
```
Başvuru #1: score = -0.32  → Normal  ✅  (eşiğin üstünde)
Başvuru #2: score = -0.71  → Anormal ⚠️  (eşiğin altında)
Başvuru #3: score = -0.58  → Sınırda... (-0.577 eşiğine çok yakın)
```

#### Önemli: Yüksek temerrüt = Otomatik anormal değil!

IF **etiket bilmez.** "Bu kişi temerrüde düşecek" değil, "bu kişinin profili diğerlerinden çok farklı" diyor. Anormal işaretlenen başvuruların temerrüt oranı genel orandan biraz yüksek çıkabilir ama bu garanti değildir. IF veri tutarsızlıklarını (örn. çok yüksek gelir + çok düşük kredi skoru kombinasyonu) yakalıyor.

**Pipeline'daki rolü:**  
`anomaly_flag=True` başvuruyu **durdurmaz** — risk skoru yine hesaplanır. Frontend bu flag'e göre uyarı gösterir:  
*"Bu başvuruda veri tutarsızlığı tespit edildi, manuel inceleme önerilir."*  
Son karar hep XGBoost'un `risk_score`'una göre verilir.

**IF train/test leakage riski:** IF unsupervised olduğu için teknik leakage sayılmaz ama "doğru pratik" olarak IF de sadece train verisi üzerinde fit edilmeli.

---

## 05_interest_rate_optimization.ipynb — Faiz Oranı Hesaplama

### Ne yapıyor?
Stage 2'den gelen `risk_score` (0-1) değerini somut bir yıllık faiz oranına çevirir.

### Üç yöntem neden karşılaştırılıyor?

```python
# linear:    rate = 5% + 15% × risk_score
# sigmoid:   rate = 5% + 15% × sigmoid(risk_score)  
# quadratic: rate = 5% + 15% × risk_score²
```

| Yöntem | Davranış |
|--------|----------|
| Linear | Risk 0→1 arası eşit ölçeklenir. Basit, öngörülebilir |
| Sigmoid | Orta riskte hassasiyet yüksek, uçlarda azalır |
| Quadratic | Düşük riski ödüllendirir, yüksek riski cezalandırır |

**Seçilen: Linear.** En yorumlanabilir. "Risk %1 arttı → faiz %0.15 arttı." Açıklanması kolay.

**Örnek çıktı:**
- risk_score = 0.1 → %6.5 faiz
- risk_score = 0.4885 (eşik) → ~%12.3 faiz  
- risk_score = 0.9 → %18.5 faiz

### Aralık neden 5%-20%?
İş kararı. Türkiye ortalama kredi faizleri göz önüne alındığında bu aralık makul. Base rate 5%, maksimum prim 15%.

### ⚠️ KRİTİK — Düzeltildi: Stale Threshold Değeri

Notebook 05'te `opt_thresh = 0.6491` hardcoded olarak yazılmıştı. Bu **yanlıştı** — gerçek optimize edilmiş eşik `0.4885`'tir. Bu hata, eski bir eğitim oturumundan kalmış ve notebook yeniden çalıştırılmamıştı.

**Etkilenen dosyalar ve durumları:**

| Dosya | Eski değer | Düzeltildi mi? |
|-------|------------|----------------|
| `notebooks/05_interest_rate_optimization.ipynb` (görselleştirme hücreleri) | `0.6491` | Notebook içi — yeniden çalıştırarak düzelir |
| `models/interest_rate_metadata.json` | `0.6491` | ✅ **Düzeltildi** (→ `0.4885`) |
| `models/xgboost_metadata.json` | `0.4885` | ✅ Zaten doğruydu |
| `src/pipeline/interest_rate.py` | Threshold içermiyor | ✅ Etkilenmedi |

> **Sonuç:** Kayıtlı artifact dosyaları artık tutarlı. Notebook görselleştirmeleri yeniden çalıştırılırsa otomatik düzelir.

---

## 06_dice_counterfactual.ipynb — "Ne Değişseydi Onaylanırdı?"

### Ne yapıyor?
Reddedilen bir başvuruya şu soruyu yanıtlar: "Hangi değişiklikleri yapsaydın krediyi alırdın?"

### DiCE-ML nedir?

**Counterfactual explanation (karşı-olgusal açıklama):** Mevcut durumun aksine bir senaryo. "Gelirin 42.000 TL değil 55.000 TL olsaydı onaylanırdın."

DiCE (Diverse Counterfactual Explanations) bunu yaparken:
1. Kullanıcının değiştirebileceği özellikleri belirle (`features_to_vary`)
2. Bu özellikler üzerinde rastgele arama yap
3. Modelin onaylayacağı (`Default=0`) senaryoları bul
4. Birbirinden farklı senaryolar üret (diversity)

**Actionable features neden sadece 3?**
```python
ACTIONABLE_FEATURES = ["LoanAmount", "HasCoSigner", "Income"]
```
Yaşını değiştiremezsin. Eğitimini bir gecede değiştiremezsin. Ama daha az para isteyebilirsin, eş-borçlu ekleyebilirsin, daha yüksek gelir belgesi sunabilirsin. Kullanıcıya "DTIRatio'nu azalt" demek anlamsız — bu nasıl yapılır? "Kredi miktarını 80.000'den 55.000'e düşür" söylenebilir.

### Background data neden gerekli?

DiCE feature uzayını anlamak için örnek veriye ihtiyaç duyar. 5.000 satırlık `loans_cleaned.csv` örneği bu amaçla kullanılıyor. Gerçekçi değer aralıklarında arama yapıyor.

### `_PipelineWrapper` ne işe yarıyor?

DiCE aday counterfactual'ları değerlendirmek için modeli çağırmalı. Ama aday veri label-encoded, pre-ratio, pre-scale formatında geliyor — standart `predict()` çağrısına hazır değil. Wrapper bu dönüşümü yapıyor: rasyo hesapla → scale → XGBoost predict.

### Çıktılardan ne anlaşılmalı?

```json
[
  {"changes": {"LoanAmount": {"from": 95000, "to": 61000}}},
  {"changes": {"HasCoSigner": {"from": "No", "to": "Yes"}}},
  {"changes": {"LoanAmount": {"from": 95000, "to": 70000}, "Income": {"from": 42000, "to": 55000}}}
]
```

Her senaryo bağımsız bir "alternatif dünya" önerisi. LLM promptuna ve React UI'ya besleniyor. Kullanıcı bunlardan birini seçip uygulaması için motive ediliyor.

---

## Notebook'lar Arası Bağlantı Haritası

```
01_EDA
  └── Veriyi anla → 02'ye geç

02_preprocessing
  ├── ÇIKTI: data/interim/loans_cleaned.csv
  └── ÇIKTI: models/label_encoders.joblib
        └──────────────────────┐
                               ▼
02b_feature_engineering ←── loans_cleaned.csv
  ├── ÇIKTI: data/processed/X_train.csv, X_test.csv, y_train.csv, y_test.csv
  └── ÇIKTI: models/scaler.joblib
        └──────────────────────────────────────┐
                                               ▼
03_xgboost_risk_model ←── X_train/X_test/y + label_encoders + scaler
  ├── ÇIKTI: models/xgboost_risk_model.joblib
  └── ÇIKTI: models/xgboost_metadata.json (threshold=0.4885, feature_names)
        └──────────────────────────────────────┐
                                               ▼
04_isolation_forest ←── X_train, X_test, y_test
  ├── ÇIKTI: models/isolation_forest.joblib
  └── ÇIKTI: reports/metrics/isolation_forest_metrics.json

05_interest_rate_optimization ←── xgboost_risk_model + X_test (görselleştirme için)
  ├── ÇIKTI: src/pipeline/interest_rate.py
  └── ÇIKTI: models/interest_rate_metadata.json

06_dice_counterfactual ←── tüm model artifacts + loans_cleaned.csv
  └── ÇIKTI: src/explainability/dice_explainer.py (API modülü gösterimi)
```

---

## Teknoloji Seçimlerinin Özeti

| Teknoloji | Neden seçildi? |
|-----------|----------------|
| **XGBoost** | Tabular data en iyi performer; SHAP ile doğal uyumu; regularization; hız |
| **Isolation Forest** | Unsupervised anomali tespiti; etiket gerektirmez; hızlı |
| **LabelEncoder** | XGBoost için yeterli; OneHot gereksiz sütun açar |
| **StandardScaler** | Pipeline tutarlılığı; DiCE için gerekli; lineer model hazırlığı |
| **SHAP TreeExplainer** | XGBoost için optimize; exact Shapley değerleri; hızlı |
| **DiCE random method** | Model-agnostic; actionable constraints destekler; hız/kalite dengesi |
| **RandomizedSearchCV** | GridSearch'ten çok daha hızlı; yeterince iyi sonuç |
| **SMOTE** | Minority oversampling; test'e dokunmaz; recall iyileştirir |
| **joblib** | scikit-learn nesneleri için standart serialization; numpy uyumlu |
| **Pydantic** | FastAPI input validation; type safety; otomatik hata mesajı |

---

## Modelleri Nasıl Test Edersin?

Eğittiğin iki modeli (`xgboost_risk_model.joblib` ve `isolation_forest.joblib`) gerçek test verisi üzerinde değerlendirmek için hazırlanmış bir script var:

```bash
# Proje kökünde çalıştır
python scripts/test_models.py
```

Script şunları yapar:
1. Her iki modeli ve metadata dosyalarını yükler
2. XGBoost'u `X_test/y_test` üzerinde çalıştırır, eşik karşılaştırması yapar
3. Confusion matrix'i insan-okunabilir formatta gösterir
4. Isolation Forest'ın `score_samples()` ve `predict()` çıktılarını açıklar
5. İki modelin birlikte çalıştığı entegre pipeline'ı simüle eder

### Çıktıları Nasıl Yorumlamalısın?

**XGBoost için bak:**
- `ROC-AUC ≈ 0.76` → Modelin temerrüt/ödeme ayırt etme gücü (%76 doğrulukla sıralıyor)
- `Recall @ optimal eşik ≈ 0.70` → Gerçek temerrütlerin %70'ini yakaladı ✅
- Confusion matrix'te `TP` ve `FN` sayılarına bak — kaç temerrüt kaçırıldı?

**Isolation Forest için bak:**
- Anormal işaretleme oranı ~%5 çıkmalı (`contamination=0.05`)
- Anormal işaretlenen başvurularda temerrüt oranı genel orandan yüksekse model anlamlı
- `score_samples()` → daha negatif = daha şüpheli; `-0.7` altı çok anormal

### Modeller Arasındaki Özellik Farkı

```
XGBoost → 20 özellik kullanır (9 orijinal + 7 kategorik + 4 türetilmiş rasyo)
Isolation Forest → 16 özellik kullanır (rasyo sütunlar YOK — farklı tarihte eğitildi)
```

Bu fark `test_models.py` tarafından otomatik olarak ele alınır.
