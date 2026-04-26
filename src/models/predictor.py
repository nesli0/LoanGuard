"""Unified LoanGuard inference pipeline (Stage 1 → 2 → 3 + SHAP)."""
import json
import logging
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from src.features.ratios import add_ratios
from src.pipeline.interest_rate import compute_interest_rate

logger = logging.getLogger(__name__)

MODEL_DIR = Path(os.getenv("LOANGUARD_MODEL_PATH", Path(__file__).resolve().parent.parent.parent / "models"))

CATEGORICAL_COLS = [
    "Education", "EmploymentType", "MaritalStatus",
    "HasMortgage", "HasDependents", "LoanPurpose", "HasCoSigner",
]

NUMERICAL_COLS_ORIGINAL = [
    "Age", "Income", "LoanAmount", "CreditScore",
    "MonthsEmployed", "NumCreditLines", "InterestRate", "LoanTerm", "DTIRatio",
]

# Must match the order scaler.joblib was fit on (02b_feature_engineering.ipynb)
NUMERICAL_COLS_ALL = NUMERICAL_COLS_ORIGINAL + [
    "LoanToIncome", "PaymentToIncome", "CreditAgePerLine", "TotalDebtBurden",
]


@dataclass
class PredictionResult:
    anomaly_flag: bool
    risk_score: float
    decision: str                  # "approved" | "rejected"
    interest_rate: Optional[float] # None if rejected
    shap_top3: list                # [{"feature", "direction", "shap_value"}, ...]
    counterfactuals: list          # populated by DiceExplainer if requested


class LoanGuardPredictor:
    """Full 3-stage LoanGuard inference pipeline.

    Accepts raw applicant data (string categoricals) and returns a structured
    prediction dict compatible with the FastAPI response schema.

    Usage:
        predictor = LoanGuardPredictor()
        result = predictor.predict({
            "Age": 35, "Income": 75000, "LoanAmount": 50000,
            "CreditScore": 650, "MonthsEmployed": 48,
            "NumCreditLines": 3, "InterestRate": 12.5,
            "LoanTerm": 36, "DTIRatio": 0.35,
            "Education": "Bachelor's", "EmploymentType": "Full-time",
            "MaritalStatus": "Married", "HasMortgage": "No",
            "HasDependents": "Yes", "LoanPurpose": "Auto",
            "HasCoSigner": "No",
        })
    """

    def __init__(self, model_dir: Path = MODEL_DIR):
        self.model_dir = Path(model_dir)
        self._load_artifacts()
        self._explainer = None  # shap.TreeExplainer — lazy, expensive to init
        logger.info("LoanGuardPredictor initialized (threshold=%.4f)", self.threshold)

    def _load_artifacts(self) -> None:
        self.label_encoders = joblib.load(self.model_dir / "label_encoders.joblib")
        self.scaler = joblib.load(self.model_dir / "scaler.joblib")
        self.xgb_model = joblib.load(self.model_dir / "xgboost_risk_model.joblib")
        self.iso_forest = joblib.load(self.model_dir / "isolation_forest.joblib")

        with open(self.model_dir / "xgboost_metadata.json", encoding="utf-8") as f:
            meta = json.load(f)
        self.threshold: float = meta["optimal_threshold"]
        self.feature_names: list = meta["feature_names"]

    # ------------------------------------------------------------------
    # Preprocessing steps (mirror 02_preprocessing + 02b_feature_engineering)
    # ------------------------------------------------------------------

    def _encode(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        for col in CATEGORICAL_COLS:
            try:
                df[col] = self.label_encoders[col].transform(df[col])
            except ValueError as exc:
                # LabelEncoder raises ValueError for values not seen during training
                bad_value = df[col].iloc[0] if not df.empty else "<unknown>"
                raise ValueError(
                    f"Gecersiz deger '{bad_value}' icin '{col}' alani. "
                    f"Beklenen degerler: {list(self.label_encoders[col].classes_)}"
                ) from exc
        return df

    @staticmethod
    def _add_ratios(df: pd.DataFrame) -> pd.DataFrame:
        """Delegate to src.features.ratios — single source of truth."""
        return add_ratios(df)

    def _scale(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df[NUMERICAL_COLS_ALL] = self.scaler.transform(df[NUMERICAL_COLS_ALL])
        return df

    def _preprocess(self, user_data: dict) -> pd.DataFrame:
        df = pd.DataFrame([user_data])
        df = self._encode(df)
        df = self._add_ratios(df)
        df = self._scale(df)
        return df[self.feature_names]

    # ------------------------------------------------------------------
    # SHAP (per-request, lazy init)
    # ------------------------------------------------------------------

    def _get_shap_top3(self, df_ready: pd.DataFrame) -> list:
        import shap
        if self._explainer is None:
            self._explainer = shap.TreeExplainer(self.xgb_model)
        shap_vals = self._explainer.shap_values(df_ready)[0]
        top_idx = np.argsort(np.abs(shap_vals))[::-1][:3]
        return [
            {
                "feature": self.feature_names[i],
                "direction": "+" if shap_vals[i] > 0 else "-",
                "shap_value": round(float(shap_vals[i]), 4),
            }
            for i in top_idx
        ]

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, user_data: dict) -> dict:
        """Run full pipeline for a single applicant.

        Args:
            user_data: Raw applicant features. Categorical fields accept
                       string values (e.g. Education="Bachelor's").

        Returns:
            Dict with keys: anomaly_flag, risk_score, decision,
            interest_rate, shap_top3, counterfactuals.

        Raises:
            ValueError: If a categorical field contains a value not seen
                        during training (propagated from _encode).
        """
        logger.info("predict() called")
        df_ready = self._preprocess(user_data)

        # Stage 1 — anomaly detection
        anomaly_flag = bool(self.iso_forest.predict(df_ready)[0] == -1)

        # Stage 2 — risk scoring
        risk_score = float(self.xgb_model.predict_proba(df_ready)[0, 1])
        decision = "approved" if risk_score < self.threshold else "rejected"
        logger.info("risk_score=%.4f  decision=%s  anomaly=%s", risk_score, decision, anomaly_flag)

        # Stage 3 — interest rate (approved only)
        interest_rate = (
            round(compute_interest_rate(risk_score) * 100, 2)
            if decision == "approved"
            else None
        )

        # SHAP explanation
        shap_top3 = self._get_shap_top3(df_ready)

        return asdict(PredictionResult(
            anomaly_flag=anomaly_flag,
            risk_score=round(risk_score, 4),
            decision=decision,
            interest_rate=interest_rate,
            shap_top3=shap_top3,
            counterfactuals=[],  # call DiceExplainer separately if needed
        ))
