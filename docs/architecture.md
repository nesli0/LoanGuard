# LoanGuard — Sistem Mimarisi

## Genel Bakış

LoanGuard, müşteri kredi başvuru verilerini analiz ederek kredi kararını destekleyen 3 aşamalı bir ML pipeline sistemidir.

## Pipeline Akışı

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Müşteri     │────▶│  Aşama 1:    │────▶│  Aşama 2:        │────▶│  Aşama 3:    │
│  Veri Girişi │     │  Anomali     │     │  Risk Skorlama   │     │  Faiz        │
│              │     │  Tespiti     │     │  (XGBoost)       │     │  Optimizasyon│
│  (Streamlit) │     │  (IsoForest) │     │                  │     │              │
└──────────────┘     └──────────────┘     └──────────────────┘     └──────────────┘
                            │                     │                       │
                            ▼                     ▼                       ▼
                     anomali_flag=1         risk_score (0-1)        optimal_rate
                     ise UYARI ver          temerrüt olasılığı      faiz oranı (%)
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │  SHAP        │
                                          │  Açıklama    │
                                          │  (XAI)       │
                                          └──────────────┘
```

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Veri İşleme | Pandas, NumPy, scikit-learn |
| ML Modelleri | Isolation Forest, XGBoost |
| Açıklanabilirlik | SHAP |
| Backend API | FastAPI |
| Frontend | Streamlit |
| Paketleme | Docker, docker-compose |
| Test | pytest |

## Veri Akışı

1. Ham veri `data/raw/` klasöründe saklanır
2. Ön-işleme sonrası `data/processed/` klasörüne yazılır
3. Eğitilmiş modeller `models/` klasörüne `.joblib` olarak kaydedilir
4. API, kaydedilmiş modelleri yükleyerek inference yapar
5. Streamlit, API üzerinden veya doğrudan modelleri çağırarak sonuç gösterir
