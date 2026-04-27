"""
Model Loader — Singleton pattern.
Tüm ML modelleri uygulama başlangıcında bir kez yüklenir,
her request'te yeniden yüklenmez.
"""

from pathlib import Path

import joblib
from loguru import logger

# Modeller backend/ klasörünün bir üstündeki models/ klasöründe
MODELS_DIR = Path(__file__).resolve().parents[4] / "models"


class MLModels:
    def __init__(self) -> None:
        self.xgboost = None
        self.scaler = None
        self.label_encoders: dict = {}
        self.isolation_forest = None
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        try:
            logger.info(f"ML modelleri yükleniyor: {MODELS_DIR}")

            self.xgboost = joblib.load(MODELS_DIR / "xgboost_risk_model.joblib")
            logger.success("✓ XGBoost yüklendi")

            self.scaler = joblib.load(MODELS_DIR / "scaler.joblib")
            logger.success("✓ Scaler yüklendi")

            self.label_encoders = joblib.load(MODELS_DIR / "label_encoders.joblib")
            logger.success(f"✓ Label encoders yüklendi: {list(self.label_encoders.keys())}")

            self.isolation_forest = joblib.load(MODELS_DIR / "isolation_forest.joblib")
            logger.success("✓ Isolation Forest yüklendi")

            self._loaded = True
            logger.success("Tüm ML modelleri hazır.")

        except Exception as e:
            logger.error(f"ML model yükleme hatası: {e}")
            raise RuntimeError(f"ML modelleri yüklenemedi: {e}") from e

    @property
    def is_ready(self) -> bool:
        return self._loaded


# Global singleton — import edilip kullanılır
ml_models = MLModels()
