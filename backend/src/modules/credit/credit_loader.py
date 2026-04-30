"""
ML Model Loader — Singleton pattern.

LoanGuardPredictor ve DiceExplainer uygulama başlarken bir kez yüklenir,
her request'te yeniden oluşturulmaz.

Proje kökündeki src/ (ML mühendisinin modülleri) sys.path'e eklenerek
import edilir — backend/src/ ile çakışmaz.
"""

import json
import sys
import importlib.util
from pathlib import Path

from loguru import logger

# Proje kökü: backend/src/modules/credit/ → 4 üst = LoanGuard/
PROJECT_ROOT = Path(__file__).resolve().parents[4]
MODELS_DIR = PROJECT_ROOT / "models"

# ── Dynamic Import (Namespace çakışmasını önlemek için) ──────────────
# Backend de "src" kullanıyor, ML kodları da "src" kullanıyor.
# sys.path'e proje kökünü eklersek backend'in src'si ile çakışıyor.
# importlib ile ML modüllerini manuel olarak sys.modules içine yüklüyoruz.
def _load_ml_module(module_name: str, rel_path: str):
    file_path = PROJECT_ROOT / rel_path
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

# Bağımlılık ağacına göre sırayla yükle
_load_ml_module("src.features.ratios", "src/features/ratios.py")
_load_ml_module("src.pipeline.interest_rate", "src/pipeline/interest_rate.py")
predictor_mod = _load_ml_module("src.models.predictor", "src/models/predictor.py")
dice_mod = _load_ml_module("src.explainability.dice_explainer", "src/explainability/dice_explainer.py")

LoanGuardPredictor = predictor_mod.LoanGuardPredictor
DiceExplainer = dice_mod.DiceExplainer

# Warm-up için kullanılacak dummy veri (model lazy init'i tetikler)
_WARMUP_INPUT = {
    "Age": 35, "Income": 75000, "LoanAmount": 50000, "CreditScore": 650,
    "MonthsEmployed": 48, "NumCreditLines": 3, "InterestRate": 12.5,
    "LoanTerm": 36, "DTIRatio": 0.35,
    "Education": "Bachelor's", "EmploymentType": "Full-time",
    "MaritalStatus": "Married", "HasMortgage": "No",
    "HasDependents": "Yes", "LoanPurpose": "Auto", "HasCoSigner": "No",
}


class MLLoader:
    """LoanGuardPredictor + DiceExplainer singleton container."""

    def __init__(self) -> None:
        self.predictor: LoanGuardPredictor | None = None
        self.dice: DiceExplainer | None = None
        self.model_version: str = "unknown"
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        try:
            # ── 1. Predictor ─────────────────────────────────────────
            logger.info("LoanGuardPredictor yükleniyor...")
            self.predictor = LoanGuardPredictor(model_dir=MODELS_DIR)
            logger.success(
                f"✓ LoanGuardPredictor hazır — threshold={self.predictor.threshold:.4f}"
            )

            # ── 2. DiceExplainer ─────────────────────────────────────
            logger.info("DiceExplainer yükleniyor...")
            self.dice = DiceExplainer(
                model_dir=MODELS_DIR,
                data_dir=PROJECT_ROOT / "data" / "interim",
            )
            logger.success("✓ DiceExplainer hazır")

            # ── 3. Model versiyonunu oku ─────────────────────────────
            with open(MODELS_DIR / "xgboost_metadata.json", encoding="utf-8") as f:
                meta = json.load(f)
            self.model_version = meta.get("model_version", "1.0.0")

            # ── 4. Warm-up (race condition + lazy init önlemi) ────────
            logger.info("Model warm-up başlıyor...")
            self.predictor.predict(_WARMUP_INPUT)
            logger.success("✓ Model warm-up tamamlandı — async istekler thread-safe")

            self._loaded = True
            logger.success(f"Tüm ML modelleri hazır (v{self.model_version})")

        except Exception as e:
            logger.error(f"ML model yükleme hatası: {e}")
            raise RuntimeError(f"ML modelleri yüklenemedi: {e}") from e

    @property
    def is_ready(self) -> bool:
        return self._loaded


# Global singleton — import edilerek kullanılır
ml_loader = MLLoader()
