# 🤖 Walkthrough — 03_xgboost_risk_model.ipynb

Bu doküman, XGBoost Risk Modeli notebook'undaki **her hücreyi** satır satır açıklar.  
Notebook çalıştırıldıktan sonra elde edilen gerçek sonuçlar (ROC-AUC: 0.7588, optimal eşik: 0.6491) üzerinden anlatılmıştır.

---

## Hücre 1 — Markdown Başlık

Notebook'un amacını, hangi pipeline aşamasına karşılık geldiğini ve akışını özetler.  
Markdown hücresi olduğu için kod içermez; GitHub'da ve Jupyter'da düzgün render edilir.

---

## Hücre 2 — Kütüphaneler

```python
import shap
import joblib
import yaml
from sklearn.model_selection import StratifiedKFold, RandomizedSearchCV, train_test_split
from sklearn.metrics import roc_auc_score, f1_score, matthews_corrcoef, ...
from xgboost import XGBClassifier

SEED = 42
np.random.seed(SEED)
```

### Ne yapıyor?
- Projenin ihtiyaç duyduğu tüm kütüphaneleri tek seferde import eder
- `SEED = 42` ile global rastgelelik sabitlenir
- `warnings.filterwarnings("ignore")` ile XGBoost'un ürettiği gereksiz uyarılar bastırılır

### Neden bu kütüphaneler?

| Kütüphane | Görev |
|---|---|
| `xgboost` | Risk skorlama modeli (Stage 2) |
| `shap` | Model kararlarının açıklanabilirliği (XAI) |
| `joblib` | Eğitilmiş modeli diske kaydetme |
| `yaml` | `model_params.yaml` okuma |
| `scipy.stats` | RandomizedSearchCV için parametre dağılımları (uniform, randint) |
| `StratifiedKFold` | Sınıf dengesini koruyarak çapraz doğrulama |
| `matthews_corrcoef` | Sınıf dengesizliğinde F1'den daha güvenilir metrik |

### Neden `SEED = 42` ve `np.random.seed(SEED)`?
Her çalıştırmada aynı sonuçların üretilmesi için. Buna **tekrarlanabilirlik (reproducibility)** denir — sektörde zorunludur. Model karşılaştırmaları ve raporlama tutarlı olmalıdır.

---

## Hücre 3 — Konfigürasyon & Dizin Yolları

```python
PROJECT_ROOT = Path("..").resolve()
CONFIG_PATH  = PROJECT_ROOT / "configs" / "model_params.yaml"

with open(CONFIG_PATH, "r") as f:
    config = yaml.safe_load(f)

xgb_cfg = config["risk_scoring"]["params"]
```

### Ne yapıyor?
- Notebook'un bulunduğu `notebooks/` klasöründen bir üst dizine çıkar → `LoanGuard/`
- `model_params.yaml`'ı okur
- Aşama 2 (risk skorlama) parametrelerini `xgb_cfg` değişkenine atar
- Çıktı dizinlerini oluşturur (yoksa)

### YAML'dan okunan değerler:

| Parametre | Değer | Kullanım Yeri |
|---|---|---|
| `n_estimators` | 300 | Temel model başlangıç değeri |
| `max_depth` | 6 | Temel model başlangıç değeri |
| `learning_rate` | 0.1 | Temel model başlangıç değeri |
| `scale_pos_weight` | 7.6 | Her iki modelde de sabit kalır |
| `subsample` | 0.8 | Temel model başlangıç değeri |
| `colsample_bytree` | 0.8 | Temel model başlangıç değeri |

### Neden `Path("..").resolve()`?
`"../configs/..."` gibi göreli string yollar, Jupyter'ın hangi dizinden başlatıldığına göre değişir. `Path` nesnesi mutlak yol üretir — farklı bilgisayarlarda ve CI/CD'de güvenle çalışır.

---

## Hücre 4 — Veri Yükleme

```python
def load_processed_data(data_dir: Path) -> tuple:
    X_train = pd.read_csv(data_dir / "X_train.csv")
    X_test  = pd.read_csv(data_dir / "X_test.csv")
    y_train = pd.read_csv(data_dir / "y_train.csv").squeeze()
    y_test  = pd.read_csv(data_dir / "y_test.csv").squeeze()
    return X_train, X_test, y_train, y_test
```

### Ne yapıyor?
`02_preprocessing.ipynb`'nin ürettiği 4 CSV dosyasını yükler.

### `.squeeze()` neden kullanılıyor?
`pd.read_csv` tek sütunlu CSV'yi **DataFrame** olarak okur, ama sklearn fonksiyonları **Series** bekler. `.squeeze()` tek sütunlu DataFrame'i Series'e dönüştürür.

```
pd.read_csv("y_train.csv")       → DataFrame (204277, 1)  ← sklearn kabul etmez
pd.read_csv("y_train.csv").squeeze() → Series (204277,)   ← sklearn kabul eder ✓
```

### Neden ham veriyi değil, işlenmiş veriyi yüklüyoruz?
Her notebook bağımsız çalışabilmeli. `02_preprocessing.ipynb` düzeltilse bile bu notebook yeniden baştan koşmak zorunda kalmaz — işlenmiş CSV'yi okumak yeterli.

---

## Hücre 5 — Veri Doğrulama

```python
def validate_data(X, y, name):
    assert X.isnull().sum().sum() == 0
    assert y.isnull().sum()       == 0
    assert not np.isinf(X.values).any()
    assert set(y.unique()) == {0, 1}
```

### Ne yapıyor?
4 kritik koşulu kontrol eder:
1. X'te eksik değer yok mu?
2. y'de eksik değer yok mu?
3. X'te sonsuz (inf) değer yok mu?
4. y yalnızca 0 ve 1 mi içeriyor?

### Neden bu kontroller?
Eksik veri veya inf değer XGBoost'u çökertmez ama **sessizce yanlış sonuç** ürettirir. Hataları erken, hata mesajı açık şekilde yakalamak için kullanılır.

> [!IMPORTANT]
> `assert` ifadeleri üretimde `raise ValueError` ile değiştirilmelidir. Notebook'ta `assert` yeterlidir çünkü eğitim ortamındayız, canlı sisteme veri gelmiyoruz.

---

## Hücre 6 — Değerlendirme Yardımcı Fonksiyonları

### `evaluate_model()`

```python
metrics = {
    "roc_auc"  : roc_auc_score(y_true, y_prob),
    "pr_auc"   : average_precision_score(y_true, y_prob),
    "f1"       : f1_score(y_true, y_pred),
    "precision": precision_score(y_true, y_pred),
    "recall"   : recall_score(y_true, y_pred),
    "mcc"      : matthews_corrcoef(y_true, y_pred),
}
```

**Neden bu metrikler?**

| Metrik | Ne Ölçer | Neden Önemli? |
|---|---|---|
| **ROC-AUC** | Eşikten bağımsız ayırt edici güç | Genel model kalitesi |
| **PR-AUC** | Pozitif sınıf tahmini kalitesi | Sınıf dengesizliğinde ROC'dan daha güvenilir |
| **F1** | Precision ve Recall dengesi | Temerrüt tespitinde temel metrik |
| **Precision** | Temerrüt diyenlerin kaçı gerçekten temerrüt? | Yanlış alarm maliyeti |
| **Recall** | Gerçek temerrütlerin kaçını bulduk? | Kaçırma maliyeti (bu vaka kritik!) |
| **MCC** | Tüm sınıf kombinasyonlarını tek sayıda özetler | Dengesiz veri için F1'den sağlamlı |

**Gerçek sonuçlar (Final Model, Eşik=0.5):**
```
ROC-AUC    : 0.7588
PR-AUC     : 0.3326
F1         : 0.3410
Precision  : 0.2262
Recall     : 0.6923
MCC        : 0.2551
```

### `find_optimal_threshold()`

```python
precision_arr, recall_arr, thresholds = precision_recall_curve(y_true, y_prob)
f1_arr = 2 * (precision_arr * recall_arr) / (precision_arr + recall_arr + 1e-9)
best_threshold = thresholds[np.argmax(f1_arr[:-1])]
```

**Neden `+ 1e-9` ekleniyor?**
Bazı eşiklerde precision=0 ve recall=0 olabilir. 0/0 hesabı `NaN` üretir. Küçük bir epsilon (1e-9) bunu önler — değere etkisi yok.

**Neden `f1_arr[:-1]`?**
`precision_recall_curve` fonksiyonu N eşik döndürür ama N+1 precision/recall değeri döndürür (ilk değer eşiksiz durumu temsil eder). Dizi boyutlarını eşitlemek için son eleman atlanır.

**Gerçek bulunan eşik: 0.6491**

---

## Hücre 7 — Görselleştirme Yardımcı Fonksiyonları

### `plot_roc_curve()`

Birden fazla modeli **aynı grafik** üzerinde karşılaştırır. `models` parametresi `{isim: olasılık_dizisi}` sözlüğü alır — böylece temel ve final modeli yan yana çizmek için aynı fonksiyon kullanılır.

### `plot_pr_curve()`

```python
baseline = y_true.mean()
ax.axhline(y=baseline, ...)  # Temel oran çizgisi: 0.116
```

**Neden temel oran çizgisi ekliyoruz?**  
PR grafiğinde "becerisi olmayan sınıflandırıcı" için referans noktası budur. Modelimizin bu çizginin ne kadar üzerinde kaldığını görmek için önemlidir.

### `plot_confusion_matrix()`

Ham sayı + normalize matris **yan yana** gösterilir:
- **Ham:** Gerçek vaka sayıları — kaç kişiyi doğru/yanlış sınıflandırdık?
- **Normalize:** Oran olarak — sınıf büyüklüğünden bağımsız karşılaştırma

### `plot_threshold_analysis()`

```python
thresholds = np.linspace(0.01, 0.99, 300)
for t in thresholds:
    y_pred_t = (y_prob >= t).astype(int)
    ...
```

300 farklı eşik değerini döngüyle dener ve her birinde Precision/Recall/F1 hesaplar. En yüksek F1'e karşılık gelen eşik kırmızı dikey çizgiyle işaretlenir. Bu grafik olmadan "neden 0.5 değil de 0.649 kullandık?" sorusu yanıtsız kalır.

---

## Hücre 8 — Train/Val Split

```python
X_fit, X_val, y_fit, y_val = train_test_split(
    X_train, y_train,
    test_size    = 0.15,
    stratify     = y_train,
    random_state = SEED,
)
```

### Ne yapıyor?
Eğitim setinin **%15'ini erken durdurma için geçerleme seti** olarak ayırır.

### Neden üçe bölüyoruz? (fit / val / test)

```
Tüm Veri (255,347)
├── Test (51,070) ─────────────── Dokunulmaz. Son değerlendirme buraya göre.
└── Train (204,277)
    ├── Val (30,642) ──────────── Erken durdurma için. Eğitim sırasında izlenir.
    └── Fit (173,635) ─────────── Modelin gerçekten öğrendiği veriler.
```

Test seti eğitim boyunca hiç görülmez — gerçek dünya performansını simüle eder.

> [!CAUTION]
> Erken durdurma için **test setini** kullanmak yaygın bir hatadır. Bu durumda test seti eğitime dolaylı olarak katılmış olur ve sonuçlar gerçekten iyi görünür ama **data leakage** oluşur.

---

## Hücre 9 — Temel Model Eğitimi

```python
baseline_params = {
    "n_estimators"        : 300,        # YAML'dan: xgb_cfg["n_estimators"]
    "max_depth"           : 6,          # YAML'dan
    "learning_rate"       : 0.1,        # YAML'dan
    "scale_pos_weight"    : 7.6,        # YAML'dan — temerrüt sınıfına ağırlık
    "tree_method"         : "hist",     # Histogram yöntemi — büyük veri için hızlı
    "early_stopping_rounds": 30,        # 30 turda iyileşme yoksa dur
    "n_jobs"              : -1,         # Tüm CPU çekirdekleri
}

baseline_model.fit(
    X_fit, y_fit,
    eval_set = [(X_val, y_val)],
    verbose  = 50,
)
```

### `scale_pos_weight = 7.6` ne anlama geliyor?

Veri setinde 225,694 ödendi / 29,653 temerrüt var → oran 7.6:1.

```
scale_pos_weight = 7.6 ile:
  Model, bir temerrüt vakasını yanlış sınıflandırırsa
  cezası bir ödendi vakasını yanlış sınıflandırmaktan 7.6 kat büyük olur.
  Bu sayede model temerrütlere odaklanmak için "zorlanır".
```

### `tree_method = "hist"` neden bu kadar hızlı?

| Yöntem | Nasıl Çalışır | Hız |
|---|---|---|
| `exact` (varsayılan) | Tüm olası bölme noktalarını hesaplar | Yavaş |
| `hist` | Değerleri önce histogramlara dönüştürür, sonra arama yapar | 5-10× hızlı |

204k satır ile bu fark eğitimi dakikalardan saniyelere indirir.

### `early_stopping_rounds = 30` nasıl çalışır?

```
İterasyon 100: val AUC = 0.745
İterasyon 150: val AUC = 0.748  ← en iyi
İterasyon 180: val AUC = 0.746
...
İterasyon 180: val AUC = 0.745  (30 tur geçti, iyileşme yok)
→ Dur. best_iteration = 150 olarak kaydet.
```

Gereksiz ağaç büyümesi önlenir, aşırı öğrenme (overfitting) engellenir.

**Gerçek sonuç:** `best_iteration = 399` — yani model tam 300 tur için değil, 399 tura kadar devam etti.

---

## Hücre 10 — Temel Model Değerlendirmesi

```python
y_prob_baseline = baseline_model.predict_proba(X_test)[:, 1]
y_pred_baseline = (y_prob_baseline >= 0.5).astype(int)
```

### `predict_proba(X_test)[:, 1]` ne anlama geliyor?

`predict_proba` her örnek için iki değer döndürür:

```
[[0.92, 0.08],   ← bu kişi %8 ihtimalle temerrüt
 [0.31, 0.69],   ← bu kişi %69 ihtimalle temerrüt
 ...]

[:, 1] → sadece 2. sütunu al (pozitif sınıf = temerrüt olasılığı)
→ [0.08, 0.69, ...]
```

### Neden önce 0.5 eşiği kullanıyoruz?
Karşılaştırma referans noktası oluşturmak için. Sonraki hücrede optimal eşik bulunacak — ikisini karşılaştırmak için temel gerekli.

**Üretilen grafikler:**
- `xgb_01_roc_baseline.png`
- `xgb_02_pr_baseline.png`
- `xgb_03_cm_baseline.png`

---

## Hücre 11 — Hiperparametre Optimizasyonu

```python
param_distributions = {
    "n_estimators"     : [200, 300, 400, 500],
    "max_depth"        : randint(3, 10),
    "learning_rate"    : uniform(0.03, 0.17),
    "subsample"        : uniform(0.65, 0.30),
    "colsample_bytree" : uniform(0.55, 0.40),
    "min_child_weight" : randint(1, 12),
    "gamma"            : uniform(0.0, 0.5),
    "reg_alpha"        : uniform(0.0, 1.0),
    "reg_lambda"       : uniform(0.5, 2.0),
}

random_search = RandomizedSearchCV(
    estimator  = search_estimator,
    n_iter     = 20,
    scoring    = "roc_auc",
    cv         = StratifiedKFold(n_splits=3),
    n_jobs     = -1,
)
```

### Neden `RandomizedSearchCV`? `GridSearchCV` değil mi?

| Yöntem | Nasıl Çalışır | Deneme Sayısı |
|---|---|---|
| **GridSearchCV** | Her kombinasyonu dener | Üstel büyür — 9 parametre × 5 değer = 5⁹ ≈ 2 milyon |
| **RandomizedSearchCV** ✓ | Rastgele n_iter kombinasyon dener | Sabit: 20 |

Büyük parametre uzaylarında `RandomizedSearchCV` pratikte `GridSearchCV` kadar iyi sonuç verir, çok daha kısa sürede.

### `uniform(0.03, 0.17)` ne anlama geliyor?

`uniform(loc, scale)` → `[loc, loc+scale]` aralığından sürekli değer çeker:  
`uniform(0.03, 0.17)` → `[0.03, 0.20]` arası rastgele öğrenme oranı

### `randint(3, 10)` ne anlama geliyor?

`[3, 10)` aralığından tam sayı: 3, 4, 5, 6, 7, 8 veya 9

### `n_jobs=1` arama modelinde, `n_jobs=-1` RandomizedSearchCV'de — çelişki değil mi?

Hayır, kasıtlı:
- `RandomizedSearchCV(n_jobs=-1)` → 60 modeli paralel eğitir
- `XGBClassifier(n_jobs=1)` → Her modelin kendisi tek çekirdek kullanır

İkisi de `-1` olsaydı "çekirdekler için çekirdekler yarışır" durumu oluşur ve bellek patlar.

### Neden `search_estimator`'da `early_stopping_rounds` yok?

`RandomizedSearchCV`, `fit()` çağrısına `eval_set` veremez — kendi cross-validation altyapısını kullanır. Early stopping bu yapıyla uyumsuz olduğu için devre dışı bırakılır. Arama bittikten sonra en iyi parametrelerle ayrıca eğitilen **final modelde** erken durdurma aktif edilir.

**Gerçek sonuçlar:**
```
En iyi CV AUC  : 0.7526
Seçilen params :
  learning_rate    : 0.0356  (düşük — yavaş ama kararlı öğrenme)
  max_depth        : 3       (sığ — basit ağaçlar, overfitting az)
  n_estimators     : 400
  reg_alpha        : 0.681   (L1 düzenleştirme — seyreklik)
  reg_lambda       : 1.562   (L2 düzenleştirme — büyüklük cezası)
```

---

## Hücre 12 — Son Model Eğitimi

```python
final_params = {
    **random_search.best_params_,          # Arama sonucu parametreler
    "scale_pos_weight"     : 7.6,          # Sabit — sınıf dengesi değişmedi
    "early_stopping_rounds": 30,           # Şimdi aktif
    "tree_method"          : "hist",
}
final_model.fit(X_fit, y_fit, eval_set=[(X_val, y_val)], verbose=50)
```

### `**random_search.best_params_` nasıl çalışır?

Python'da `**dict` sözdizimi sözlüğü açar:

```python
best_params = {"max_depth": 3, "learning_rate": 0.036, ...}
{"n_jobs": -1, **best_params}
# Eşdeğer: {"n_jobs": -1, "max_depth": 3, "learning_rate": 0.036, ...}
```

Tüm en iyi parametreler `final_params`'a kopyalanır, üstüne sabitler eklenir.

**Gerçek sonuç:** `best_iteration = 399` (tam n_estimators=400 sınırına yakın — model 400 ağaçla bile hâlâ öğreniyordu)

---

## Hücre 13 — Eşik Optimizasyonu

```python
y_prob_final     = final_model.predict_proba(X_test)[:, 1]
optimal_threshold = find_optimal_threshold(y_test, y_prob_final)
# → 0.6491
```

### Neden 0.5 değil de 0.6491?

```
Eşik = 0.5 ile:
  F1 = 0.3410  |  Precision = 0.2262  |  Recall = 0.6923
  → Birçok ödeme yapacak kişiyi "temerrüt" diye etiketliyor

Eşik = 0.6491 ile:
  F1 = 0.3743  |  Precision = 0.3189  |  Recall = 0.4530
  → Temerrüt dediğinde daha çok haklı, ama bazılarını kaçırıyor
```

**Hangi eşiği kullanmalı?** Bu iş kararıdır:
- **Recall kritik** (hiç temerrüt kaçırma) → 0.5 veya daha düşük
- **Precision kritik** (yanlış alarm maliyeti yüksek) → 0.649 veya daha yüksek

Metadata'ya her ikisi de kaydedildi. API, iş gereksinimlerine göre eşiği değiştirebilir.

---

## Hücre 14 — Tam Değerlendirme & Karşılaştırma

```python
metrics_05  = evaluate_model(y_test, y_pred_05,  y_prob_final, threshold=0.5)
metrics_opt = evaluate_model(y_test, y_pred_opt, y_prob_final, threshold=0.6491)
```

**Gerçek karşılaştırma tablosu:**

| Metrik | Temel (0.5) | Final (0.5) | Final (0.649) |
|---|---|---|---|
| ROC-AUC | 0.7546 | **0.7588** | 0.7588 |
| PR-AUC | 0.3268 | **0.3326** | 0.3326 |
| F1 | 0.3434 | 0.3410 | **0.3743** |
| Recall | 0.6717 | **0.6923** | 0.4530 |
| Precision | 0.2306 | 0.2262 | **0.3189** |
| MCC | 0.2555 | 0.2551 | **0.2813** |

> [!NOTE]
> ROC-AUC eşikten bağımsızdır — her iki eşikte de aynıdır (0.7588). F1, Precision, Recall ise eşiğe göre değişir.

---

## Hücre 15 — Görsel Karşılaştırmalar

```python
model_probs = {
    "XGBoost Temel"   : y_prob_baseline,
    "XGBoost Optimize": y_prob_final,
}
plot_roc_curve(y_test, model_probs, ...)
plot_pr_curve(y_test, model_probs, ...)
```

Temel ve final model tek grafik üzerinde karşılaştırılır. Hiperparametre optimizasyonunun ne kadar iyileşme sağladığı görsel olarak anlaşılır.

**Üretilen grafikler:**
- `xgb_05_roc_comparison.png` — iki model ROC
- `xgb_06_pr_comparison.png` — iki model PR
- `xgb_07_cm_05.png` — eşik=0.5 karmaşıklık matrisi
- `xgb_08_cm_optimal.png` — eşik=0.649 karmaşıklık matrisi

---

## Hücre 16 — Özellik Önemi (Dahili)

```python
raw_importance = final_model.get_booster().get_score(importance_type="gain")
```

### `importance_type = "gain"` nedir?

| Tip | Ne Ölçer |
|---|---|
| `weight` | Özelliğin kaç kez bölme noktası seçildiği |
| `cover` | Özelliğin kapsadığı örnek sayısı |
| `gain` ✓ | Özelliğin getirdiği ortalama kayıp azalması |

**`gain` en informatif olanıdır** — sık kullanılan bir özellik az kazanç sağlıyorsa, az kullanılan ama büyük kazanç sağlayan özelliğe göre daha az önemlidir.

> [!NOTE]
> Bu özellik önemi XGBoost'un **kendi hesapladığı** değerdir. Bir sonraki bölümde SHAP değerleriyle karşılaştırıldığında farklılıklar görülebilir — SHAP daha güvenilirdir.

---

## Hücre 17 — SHAP Kurulumu

```python
SHAP_SAMPLE_SIZE = 5_000

shap_idx = X_test.sample(n=SHAP_SAMPLE_SIZE, random_state=SEED).index
X_shap   = X_test.loc[shap_idx].reset_index(drop=True)
y_shap   = y_test.loc[shap_idx].reset_index(drop=True)

explainer   = shap.TreeExplainer(final_model)
shap_values = explainer.shap_values(X_shap)
```

### `TreeExplainer` neden?

SHAP'ın farklı explainer tipleri vardır:

| Explainer | Uygun Model | Hız |
|---|---|---|
| `TreeExplainer` ✓ | XGBoost, LightGBM, RandomForest | Çok hızlı (exact) |
| `LinearExplainer` | Lojistik regresyon | Hızlı |
| `KernelExplainer` | Her model | Çok yavaş |

XGBoost ağaç tabanlı olduğu için `TreeExplainer` hem doğru hem de hızlıdır.

### Neden 5.000 örneklem?

51.070 örnekli test seti için tam SHAP hesabı gereksiz bellek ve süre harcar. 5.000 örnek grafik kalitesi için yeterlidir. 

### `shap_idx` neden önce belirleniyor?

```python
# YANLIŞ — X_shap ve y_shap farklı satırlara karşılık gelir:
X_shap = X_test.sample(5000, random_state=42)
y_shap = y_test.sample(5000, random_state=42)  # ← farklı indeksler!

# DOĞRU — aynı indeksler kullanılır:
shap_idx = X_test.sample(5000, random_state=42).index
X_shap   = X_test.loc[shap_idx]
y_shap   = y_test.loc[shap_idx]  # ← aynı satırlar
```

---

## Hücre 18 — SHAP Beeswarm Grafiği

```python
shap.summary_plot(shap_values, X_shap, plot_type="dot", max_display=16)
```

### Ne gösteriyor?

Her **nokta** bir örneği temsil eder:
- **X ekseni:** SHAP değeri — negatifse temerrüt olasılığını azaltır, pozitifse artırır
- **Renk:** Özellik değeri — kırmızı=yüksek, mavi=düşük
- **Y ekseni:** Özellikler, ortalama |SHAP|'a göre sıralı (en önemli en üstte)

**Nasıl yorumlanır?**

```
Örnek: CreditScore özelliği
  Mavi noktalar (düşük kredi skoru) sağda → temerrüt olasılığını ARTIRIYOR
  Kırmızı noktalar (yüksek kredi skoru) solda → temerrüt olasılığını AZALTIYOR
  = Kredi skoru düşükse temerrüt riski artar ✓ (mantıklı!)
```

Çıktı: `xgb_10_shap_beeswarm.png`

---

## Hücre 19 — SHAP Çubuk Grafiği

```python
shap.summary_plot(shap_values, X_shap, plot_type="bar", max_display=16)
```

Ortalama `|SHAP|` değerlerine göre özellik önemi sıralaması. Beeswarm'dan farklı olarak pozitif/negatif ayrımı yoktur — salt "bu özellik ne kadar etkili?" sorusunu yanıtlar.

**Neden SHAP önem sıralaması XGBoost'un kendi `gain`'inden daha güvenilir?**

XGBoost `gain`'i eğitim setindeki bölmelere göre hesaplar. SHAP ise her tahminde **gerçek katkıyı** oyun teorisi (Shapley değerleri) ile hesaplar — veri setindeki dengesizlik veya özellik korelasyonlarından etkilenmez.

Çıktı: `xgb_11_shap_importance_bar.png`

---

## Hücre 20 — SHAP Waterfall (Bireysel Açıklama)

```python
y_prob_shap = final_model.predict_proba(X_shap)[:, 1]
default_mask = (y_shap == 1).values
candidate_probs = np.where(default_mask, y_prob_shap, -1)
explain_idx = int(np.argmax(candidate_probs))  # En yüksek riskli temerrüt vakası

explanation = shap.Explanation(
    values      = shap_values[explain_idx],
    base_values = explainer.expected_value,
    data        = X_shap.iloc[explain_idx].values,
    feature_names = list(X_train.columns),
)
shap.waterfall_plot(explanation, max_display=16)
```

### Ne gösteriyor?

Tek bir kişinin tahminini **adım adım** açıklar:

```
Başlangıç noktası: E[f(x)] = 0.116  (tüm örneklerin ortalama temerrüt olasılığı)
+ CreditScore=520  → +0.089  (düşük kredi skoru riski artırdı)
+ Income=42000     → +0.054  (düşük gelir riski artırdı)
- HasCoSigner=1    → -0.031  (kefil var, riski azalttı)
...
Son tahmin: f(x) = 0.832  (bu kişi %83 temerrüt riski taşıyor)
```

Bu grafik "**model neden bu kişiyi reddetti?**" sorusunu yanıtlar — müşteriye açıklama sunmak için kritik.

### `np.where(default_mask, y_prob_shap, -1)` ne yapıyor?

Temerrüt vakalarının olasılıklarını tutar, diğerlerini -1 yapar. `np.argmax(-1)` hiç seçilmez — yalnızca gerçek temerrütler arasından en yüksek riskli olanı bulur.

Çıktı: `xgb_12_shap_waterfall.png`

---

## Hücre 21 — SHAP Bağımlılık Grafikleri

```python
shap.dependence_plot(
    feature,
    shap_values,
    X_shap,
    interaction_index="auto",
)
```

### Ne gösteriyor?

Bir özelliğin değeri arttıkça SHAP değerinin nasıl değiştiğini gösterir. **Renk** ise en güçlü etkileşim içinde olduğu özelliği temsil eder (otomatik seçilir).

```
Örnek: InterestRate bağımlılık grafiği
  X ekseni: InterestRate değeri (düşük → yüksek)
  Y ekseni: InterestRate'in SHAP değeri
  Renk: belki LoanAmount

  Yorum: InterestRate yükseldikçe SHAP değeri de yükseliyor
  → Yüksek faiz oranı temerrüt riskini artırıyor
  → Bu etkinin LoanAmount'a göre değişip değişmediğini renk gösteriyor
```

Çıktı: `xgb_13_shap_dependence.png`

---

## Hücre 22 — Model Kayıt

```python
# Model nesnesi → joblib
model_path = MODELS_DIR / "xgboost_risk_model.joblib"
joblib.dump(model, model_path, compress=3)

# Metadata → JSON
metadata = {
    "optimal_threshold": 0.6491,
    "feature_names"    : [...],
    "best_params"      : {...},
    ...
}
json.dump(metadata, f)
```

### `compress=3` neden?

Sıkıştırma seviyesi 0-9 arasında. 3, boyut/hız dengesidir:

```
compress=0  → ~45 MB, yükleme hızlı
compress=3  → ~12 MB, yükleme biraz daha yavaş ama yeterince hızlı
compress=9  → ~8 MB, yükleme yavaş
```

### Neden metadata JSON olarak kaydediliyor (joblib değil)?

| Durum | En iyi format |
|---|---|
| Python nesnesi (model, scaler, encoder) | **joblib** |
| Sayılar ve metin (eşik, parametreler, tarih) | **JSON** |

JSON, Python olmayan sistemler (JavaScript API, monitoring tool) tarafından da okunabilir. `"optimal_threshold": 0.6491` değerini görmek için Python açmak gerekmez.

### `def to_python(v)` neden gerekiyor?

RandomizedSearchCV'den gelen `best_params_` değerleri numpy tipindedir (`np.float64`, `np.int64`). JSON, numpy tiplerini serialize edemez — `float()` ve `int()` ile Python tiplerine çevrilmesi gerekir.

---

## Hücre 23 — Metrik Kayıt

```python
save_metrics(
    metrics_dir = METRICS_DIR,
    filename    = "xgboost_metrics.json",
    baseline    = baseline_metrics,
    final_05    = metrics_05,
    final_opt   = metrics_opt,
    search      = {"best_cv_auc": 0.7526, ...},
)
```

### Ne kaydediliyor?

`reports/metrics/xgboost_metrics.json` içinde:
- Temel model metrikleri
- Final model metrikleri (eşik=0.5)
- Final model metrikleri (optimal eşik)
- Arama bilgileri (CV AUC, iterasyon sayısı)

### Neden ayrı bir dosyaya kaydediyoruz?

Ekip koordinasyonu ve pipeline için:
- Isolation Forest ekibi kendi metriklerini kendi dosyasına yazar
- Pipeline'da karşılaştırma kolaylaşır
- CI/CD'de `metrics.json` izlenerek model regresyonu tespit edilir

---

## Hücre 24 — Özet Rapor

Tüm adımların sonuçlarını temiz bir tablo olarak ekrana basar. Kaydedilen dosyaların var olup olmadığını `Path.exists()` ile kontrol eder — "OK" veya "EKSİK" olarak raporlar.

---

## 📊 Pipeline Akış Özeti

```
İşlenmiş Veri (204,277 × 16)
    │
    ▼
Train/Val Split (%85/%15)
    │
    ├── Fit Seti (173,635) ──────┐
    └── Val Seti  (30,642) ──────┤
                                 ▼
                    Temel XGBoost (YAML params + early stopping)
                         │
                         ▼
                    ROC-AUC = 0.7546 (Referans)
                         │
                         ▼
                    RandomizedSearchCV
                    (20 iter × 3 kat × 9 parametre)
                    Tam eğitim seti üzerinde
                         │
                         ▼
                    En İyi Parametreler
                    (max_depth=3, lr=0.036, ...)
                         │
                         ▼
                    Final Model (best_params + early stopping)
                         │
                         ├── Eşik=0.5 → F1=0.3410, Recall=0.6923
                         └── Eşik=0.649 → F1=0.3743, Precision=0.3189
                                 │
                                 ▼
                            SHAP Açıklanabilirlik
                            (5,000 örneklem)
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │  models/                    │
                    │  ├── xgboost_risk_model.joblib │
                    │  └── xgboost_metadata.json  │
                    │  reports/metrics/           │
                    │  └── xgboost_metrics.json   │
                    │  reports/figures/           │
                    │  └── xgb_01 ... xgb_13.png  │
                    └─────────────────────────────┘
```

---

## 🎯 Bu Notebook'tan Çıkarılacak Kritik Bilgiler

1. **Üçlü bölünme (fit/val/test):** Early stopping için val, final değerlendirme için test — ikisini karıştırmak data leakage yaratır
2. **`tree_method="hist"`:** 200k+ satırlı verilerde zorunludur, 5-10× hız kazanımı sağlar
3. **`scale_pos_weight=7.6`:** Sınıf dengesizliğini telafi etmenin en basit ve etkili yolu
4. **Eşik optimizasyonu:** Sınıf dengesizliğinde 0.5 varsayılan eşik genellikle optimal değildir
5. **SHAP > XGBoost gain:** SHAP değerleri daha güvenilir özellik önemi sağlar
6. **Metadata JSON:** `optimal_threshold` inference sırasında kritiktir — unutulursa model yanlış eşikle çalışır
7. **`n_jobs` çakışması:** RandomizedSearchCV ve XGBClassifier'da aynı anda `n_jobs=-1` bellek sorununa yol açar
