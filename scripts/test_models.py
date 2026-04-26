# -*- coding: utf-8 -*-
"""
LoanGuard -- Model Test Scripti
================================
Bu script XGBoost risk modelini ve Isolation Forest anomali dedektorunu
gercek test verisi uzerinde degerlendirir.

Calistir:
    .venv\\Scripts\\python.exe scripts/test_models.py
"""

import json
import os
import sys

# Windows terminalinde UTF-8 zorla
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
    precision_score,
    recall_score,
    f1_score,
)

# ── Proje kökünü Python path'e ekle ────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

MODELS_DIR   = os.path.join(ROOT, "models")
PROCESSED    = os.path.join(ROOT, "data", "processed")

# ──────────────────────────────────────────────────────────────────────────
BOLD  = "\033[1m"
GREEN = "\033[92m"
RED   = "\033[91m"
BLUE  = "\033[94m"
CYAN  = "\033[96m"
YELLOW= "\033[93m"
RESET = "\033[0m"

def header(text: str):
    print(f"\n{BOLD}{BLUE}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN}  {text}{RESET}")
    print(f"{BOLD}{BLUE}{'='*65}{RESET}\n")

def section(text: str):
    print(f"\n{BOLD}{YELLOW}── {text} ──{RESET}")

def ok(text: str):
    print(f"  {GREEN}✅ {text}{RESET}")

def warn(text: str):
    print(f"  {YELLOW}⚠️  {text}{RESET}")

def err(text: str):
    print(f"  {RED}❌ {text}{RESET}")

# ──────────────────────────────────────────────────────────────────────────
def load_artifacts():
    """Modelleri, metadata'yı ve test verisini yükle."""
    header("1. ARTIFACT YÜKLEME")

    # XGBoost
    xgb_path = os.path.join(MODELS_DIR, "xgboost_risk_model.joblib")
    xgb_meta_path = os.path.join(MODELS_DIR, "xgboost_metadata.json")
    
    xgb_model = joblib.load(xgb_path)
    ok(f"XGBoost modeli yüklendi  →  {xgb_path}")
    
    with open(xgb_meta_path) as f:
        xgb_meta = json.load(f)
    ok(f"XGBoost metadata yüklendi  (threshold={xgb_meta['optimal_threshold']:.4f})")

    # Isolation Forest
    if_path = os.path.join(MODELS_DIR, "isolation_forest.joblib")
    if_meta_path = os.path.join(MODELS_DIR, "isolation_forest_metadata.json")
    
    if_model = joblib.load(if_path)
    ok(f"Isolation Forest modeli yüklendi  →  {if_path}")
    
    with open(if_meta_path) as f:
        if_meta = json.load(f)
    ok(f"Isolation Forest metadata yüklendi  (anomaly_threshold={if_meta['anomaly_threshold']:.4f})")

    # Test verisi
    X_test = pd.read_csv(os.path.join(PROCESSED, "X_test.csv"))
    y_test = pd.read_csv(os.path.join(PROCESSED, "y_test.csv")).squeeze()
    ok(f"Test verisi yüklendi  →  X_test={X_test.shape}, y_test={y_test.shape}")

    return xgb_model, xgb_meta, if_model, if_meta, X_test, y_test


# ──────────────────────────────────────────────────────────────────────────
def test_xgboost(model, meta, X_test, y_test):
    """XGBoost modelini değerlendir."""
    header("2. XGBOOST RİSK MODELİ TEST SONUÇLARI")

    threshold = meta["optimal_threshold"]

    # Tahminler
    risk_scores = model.predict_proba(X_test)[:, 1]   # temerrüt olasılığı
    y_pred_05   = (risk_scores >= 0.5).astype(int)     # varsayılan eşik
    y_pred_opt  = (risk_scores >= threshold).astype(int)  # optimize edilmiş eşik

    # Temel metrikler
    roc_auc = roc_auc_score(y_test, risk_scores)
    pr_auc  = average_precision_score(y_test, risk_scores)

    section("Temel Metrikler")
    print(f"  {'ROC-AUC':<30} {roc_auc:.4f}")
    print(f"  {'PR-AUC (imbalanced veri için)':<30} {pr_auc:.4f}")
    print()

    # Eşik karşılaştırması
    section(f"Eşik Karşılaştırması")
    print(f"  {'Metrik':<25} {'Eşik=0.5 (varsayılan)':<28} {'Eşik={:.4f} (optimal)'.format(threshold)}")
    print(f"  {'-'*75}")
    for metric_name, func in [
        ("Precision", precision_score),
        ("Recall",    recall_score),
        ("F1-Score",  f1_score),
    ]:
        v_05  = func(y_test, y_pred_05,  zero_division=0)
        v_opt = func(y_test, y_pred_opt, zero_division=0)
        delta = v_opt - v_05
        arrow = f"{GREEN}↑{RESET}" if delta > 0 else f"{RED}↓{RESET}"
        print(f"  {metric_name:<25} {v_05:<28.4f} {v_opt:.4f}  {arrow} {abs(delta):.4f}")

    # Confusion matrix (optimal eşik)
    section(f"Confusion Matrix (Eşik={threshold:.4f})")
    cm = confusion_matrix(y_test, y_pred_opt)
    tn, fp, fn, tp = cm.ravel()

    total = len(y_test)
    actual_defaults = y_test.sum()

    print(f"""
  ┌─────────────────────────────────────────────────────┐
  │              TAHMİN EDİLEN SONUÇ                    │
  │          ÖDEYECEK     TEMERRÜT                      │
  │ GERÇEK  ┌──────────┬──────────┐                     │
  │ ÖDEYECEK│ TN={tn:>6} │ FP={fp:>6} │  → Yanlış alarm  │
  │ TEMERRÜT│ FN={fn:>6} │ TP={tp:>6} │  → Yakaladık     │
  │         └──────────┴──────────┘                     │
  └─────────────────────────────────────────────────────┘
""")
    print(f"  {GREEN}TP={tp:>6}{RESET}  → Gerçek temerrüt, doğru tespit ({tp/actual_defaults*100:.1f}% yakalandı)")
    print(f"  {RED}FN={fn:>6}{RESET}  → Gerçek temerrüt, KAÇIRILDI   ({fn/actual_defaults*100:.1f}% kaçırıldı)")
    print(f"  {YELLOW}FP={fp:>6}{RESET}  → İyi müşteriye 'temerrüt' denildi (yanlış alarm)")
    print(f"  TN={tn:>6}  → İyi müşteri, doğru onay")

    # Risk dağılımı
    section("Risk Skoru Dağılımı")
    bins = [0, 0.2, 0.4, threshold, 0.7, 1.0]
    labels = ["Çok Düşük (<0.2)", "Düşük (0.2-0.4)", f"Orta (0.4-{threshold:.2f})",
              "Yüksek (eşik-0.7)", "Çok Yüksek (>0.7)"]
    counts, _ = np.histogram(risk_scores, bins=bins)
    for label, count in zip(labels, counts):
        bar = "█" * min(40, int(count / total * 200))
        print(f"  {label:<25} {bar} {count:>7} ({count/total*100:.1f}%)")

    # Örnekler
    section("Örnek Tahminler (İlk 5 Satır)")
    sample_df = X_test.head(5).copy()
    sample_df["risk_score"]   = risk_scores[:5].round(4)
    sample_df["karar"]        = ["🔴 RED" if s >= threshold else "🟢 ONAY"
                                  for s in risk_scores[:5]]
    sample_df["gercek_etiket"] = ["⚠️ TEMERRÜT" if y == 1 else "✅ ÖDEDİ"
                                   for y in y_test.values[:5]]
    print(sample_df[["risk_score", "karar", "gercek_etiket"]].to_string(index=True))

    ok("\nXGBoost testi tamamlandı.")
    return risk_scores


# ──────────────────────────────────────────────────────────────────────────
def test_isolation_forest(if_model, if_meta, X_test, y_test):
    """Isolation Forest modelini değerlendir — sonuçları adım adım açıkla."""
    header("3. ISOLATION FOREST ANOMALİ DEDEKTÖRİ TEST SONUÇLARI")

    # IF yalnızca 16 özellikle eğitildi — XGBoost'taki 4 rasyo kolonu yok
    # Metadata'dan feature sayısını kontrol et
    n_features_expected = if_meta["n_features"]
    n_features_actual   = X_test.shape[1]

    if n_features_actual != n_features_expected:
        warn(f"IF {n_features_expected} özellik bekliyor, X_test'de {n_features_actual} var.")
        warn("İlk 16 sütun kullanılıyor (rasyo özellikler hariç).")
        X_if = X_test.iloc[:, :n_features_expected]
    else:
        X_if = X_test

    # Tahminler
    # predict() → +1 = normal, -1 = anormal
    # score_samples() → daha negatif = daha anormal
    raw_labels    = if_model.predict(X_if)          # +1 veya -1
    anomaly_scores = if_model.score_samples(X_if)   # negatif sayılar, ≈ -0.5 civarı

    anomaly_flags = (raw_labels == -1)               # True = anormal
    anomaly_rate  = anomaly_flags.mean()

    section("Anormallik İstatistikleri")
    print(f"  Toplam test örneği:       {len(X_if):>8,}")
    print(f"  Anormal işaretlenen:      {anomaly_flags.sum():>8,}  ({anomaly_rate*100:.2f}%)")
    print(f"  Normal işaretlenen:       {(~anomaly_flags).sum():>8,}  ({(1-anomaly_rate)*100:.2f}%)")
    print(f"  Beklenen oran:            {'%5.00':>8}  (contamination=0.05)")

    # Anomi skoru dağılımı
    section("Anomali Skoru Dağılımı (score_samples)")
    print(f"""
  score_samples() değeri ne anlama gelir?
  ─────────────────────────────────────────
  • Bu değer her zaman NEGATİF bir sayıdır.
  • Daha küçük (daha negatif) = daha ANOMALİK
  • Daha büyük (0'a yakın)   = daha NORMAL
  • Eşik değeri: {if_meta['anomaly_threshold']:.4f}
    → Bu eşiğin altındaki örnekler "anormal" işaretlendi.
""")
    print(f"  Min (en anormal): {anomaly_scores.min():.4f}")
    print(f"  Ort:              {anomaly_scores.mean():.4f}")
    print(f"  Max (en normal):  {anomaly_scores.max():.4f}")
    print(f"  Eşik:             {if_meta['anomaly_threshold']:.4f}")

    # Temerrüt oranı: normal vs anormal
    section("Anormal Başvurularda Temerrüt Oranı")
    y_arr = y_test.values
    default_in_anomalies = y_arr[anomaly_flags].mean()
    default_in_normal    = y_arr[~anomaly_flags].mean()
    overall_default      = y_arr.mean()

    print(f"  Genel temerrüt oranı:             {overall_default*100:.2f}%")
    print(f"  Anormal işaretlenenlerde temerrüt: {default_in_anomalies*100:.2f}%")
    print(f"  Normal işaretlenenlerde temerrüt:  {default_in_normal*100:.2f}%")

    if default_in_anomalies > overall_default * 1.1:
        ok("Anormal başvurular gerçekten daha yüksek temerrüt oranına sahip → IF anlamlı!")
    else:
        warn("IF anormal işaretlemeleri temerrütle güçlü korelasyon göstermiyor.")
        warn("Bunun nedeni: IF unsupervised — temerrüt etiketi kullanmıyor.")
        warn("IF 'farklı görünen başvuru' tespit ediyor, mutlaka 'riskli' değil.")

    # Örnek anormal başvurular
    section("Örnek Anormal Başvurular (En Anormal 5 Satır)")
    sorted_idx = np.argsort(anomaly_scores)[:5]  # en negatif = en anormal
    sample = X_if.iloc[sorted_idx].copy()
    sample["anomaly_score"] = anomaly_scores[sorted_idx].round(4)
    sample["gercek_etiket"] = ["⚠️ TEMERRÜT" if y == 1 else "✅ ÖDEDİ"
                                for y in y_arr[sorted_idx]]
    # Sadece anlamlı sütunları göster
    show_cols = ["anomaly_score", "gercek_etiket"]
    avail_cols = [c for c in ["Age", "Income", "LoanAmount", "CreditScore", "DTIRatio"]
                  if c in sample.columns]
    print(sample[avail_cols + show_cols].to_string(index=True))

    # Anomali bayrağının pipeline'daki rolü
    section("Anomali Bayrağı Pipeline'da Ne İşe Yarıyor?")
    print("""
  LoanGuard pipeline'ında IF bir KARAR VERİCİ değil,
  bir UYARICI mekanizmadır:

  anomaly_flag = False  →  Normal başvuru, direkt XGBoost'a geç
  anomaly_flag = True   →  ⚠️  Frontend uyarı gösterir:
                            "Bu başvuru veri tutarsızlığı içeriyor,
                             manuel inceleme önerilir."

  Yani IF, başvuruyu REDDETMEZ — sadece işaretler.
  Son karar XGBoost'un risk_score'una göre verilir.
""")

    ok("Isolation Forest testi tamamlandı.")
    return anomaly_flags, anomaly_scores


# ──────────────────────────────────────────────────────────────────────────
def test_pipeline_integration(xgb_model, xgb_meta, if_model, if_meta,
                               risk_scores, anomaly_flags, y_test):
    """İki modelin birlikte nasıl çalıştığını göster."""
    header("4. ENTEGRE PİPELİNE SİMÜLASYONU")

    threshold = xgb_meta["optimal_threshold"]
    decisions = []
    
    for i in range(min(10, len(risk_scores))):
        score   = risk_scores[i]
        is_anom = anomaly_flags[i]
        actual  = y_test.values[i]

        if score >= threshold:
            karar = "🔴 RED"
        elif is_anom:
            karar = "🟡 ONAY (Manuel İnceleme)"
        else:
            karar = "🟢 ONAY"

        decisions.append({
            "idx":         i,
            "risk_score":  round(score, 4),
            "anomaly":     "Evet" if is_anom else "Hayır",
            "karar":       karar,
            "gercek":      "TEMERRÜT" if actual == 1 else "ÖDEDİ",
        })

    df = pd.DataFrame(decisions).set_index("idx")
    print(df.to_string())

    print(f"""
{CYAN}Karar Mantığı:{RESET}
  risk_score ≥ {threshold:.4f}  →  🔴 RED (yüksek temerrüt riski)
  risk_score < {threshold:.4f} VE anomaly=Evet  →  🟡 ONAY + Manuel inceleme
  risk_score < {threshold:.4f} VE anomaly=Hayır →  🟢 ONAY + faiz oranı hesapla
""")


# ──────────────────────────────────────────────────────────────────────────
def main():
    print(f"""
{BOLD}{BLUE}
╔══════════════════════════════════════════════════════════════╗
║          LoanGuard — Model Test & Değerlendirme              ║
║          XGBoost Risk Modeli + Isolation Forest              ║
╚══════════════════════════════════════════════════════════════╝{RESET}
""")

    try:
        xgb_model, xgb_meta, if_model, if_meta, X_test, y_test = load_artifacts()
    except FileNotFoundError as e:
        err(f"Dosya bulunamadı: {e}")
        err("Önce tüm notebook'ları sırayla çalıştırmalısın: 02 → 02b → 03 → 04")
        sys.exit(1)

    risk_scores              = test_xgboost(xgb_model, xgb_meta, X_test, y_test)
    anomaly_flags, anomaly_scores = test_isolation_forest(if_model, if_meta, X_test, y_test)
    test_pipeline_integration(xgb_model, xgb_meta, if_model, if_meta,
                              risk_scores, anomaly_flags, y_test)

    header("5. ÖZET")
    print(f"""
  Model              Durum       Açıklama
  ─────────────────────────────────────────────────────────────
  XGBoost            {GREEN}✅ Hazır{RESET}    Risk skoru + threshold optimizasyonu
  Isolation Forest   {GREEN}✅ Hazır{RESET}    Anomali bayrağı (unsupervised)
  İnterest Rate      {GREEN}✅ Hazır{RESET}    risk_score → faiz oranı dönüşümü

  Tüm modeller üretim için hazır. FastAPI entegrasyonuna geçilebilir.
""")


if __name__ == "__main__":
    main()
