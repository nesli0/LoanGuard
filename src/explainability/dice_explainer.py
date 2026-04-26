"""DiCE-ML counterfactual explanations — "what would need to change for approval?"

Background data: data/interim/loans_cleaned.csv (label-encoded, pre-ratio, pre-scale).
Model wrapper: applies ratio computation + scaling before calling XGBoost.

Actionable features (realistic changes an applicant can make):
  - LoanAmount   : request a smaller loan
  - HasCoSigner  : add a co-signer (0=No → 1=Yes)
  - Income       : demonstrate higher/stable income
"""
import json
import os
import warnings
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from src.features.ratios import add_ratios

MODEL_DIR = Path(os.getenv("LOANGUARD_MODEL_PATH", Path(__file__).resolve().parent.parent.parent / "models"))
DATA_DIR = Path(os.getenv("LOANGUARD_DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data" / "interim"))

CATEGORICAL_COLS = [
    "Education", "EmploymentType", "MaritalStatus",
    "HasMortgage", "HasDependents", "LoanPurpose", "HasCoSigner",
]

NUMERICAL_COLS_ORIGINAL = [
    "Age", "Income", "LoanAmount", "CreditScore",
    "MonthsEmployed", "NumCreditLines", "InterestRate", "LoanTerm", "DTIRatio",
]

NUMERICAL_COLS_ALL = NUMERICAL_COLS_ORIGINAL + [
    "LoanToIncome", "PaymentToIncome", "CreditAgePerLine", "TotalDebtBurden",
]

# Features an applicant can realistically change before reapplying
ACTIONABLE_FEATURES = ["LoanAmount", "HasCoSigner", "Income"]



class _PipelineWrapper:
    """sklearn-compatible wrapper: pre-encoded data → ratios → scale → predict.

    DiCE generates candidate counterfactuals in the pre-scaled feature space
    (same space as loans_cleaned.csv) and calls this wrapper to evaluate them.
    """

    def __init__(self, scaler, xgb_model, feature_names: list, threshold: float):
        self._scaler = scaler
        self._xgb = xgb_model
        self._feature_names = feature_names
        self._threshold = threshold   # must match xgboost_metadata.json

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        # Use the real optimal threshold, not the arbitrary 0.5 default
        return (self.predict_proba(X)[:, 1] >= self._threshold).astype(int)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        X = X.copy()
        # DiCE categorical columns'i object/category dtype yapiyor;
        # XGBoost 2.x bunu reddeder — hepsini float'a cevir.
        for col in X.columns:
            X[col] = pd.to_numeric(X[col], errors="coerce")
        X = add_ratios(X)   # shared implementation from src.features.ratios
        X[NUMERICAL_COLS_ALL] = self._scaler.transform(X[NUMERICAL_COLS_ALL])
        return self._xgb.predict_proba(X[self._feature_names])


class DiceExplainer:
    """Counterfactual generator using DiCE-ML.

    DiCE setup (background data + dice object) is lazy — built on first call
    to generate_counterfactuals to avoid unnecessary overhead.

    Usage:
        dice = DiceExplainer()
        scenarios = dice.generate_counterfactuals(user_data_raw)
        # user_data_raw: same format as LoanGuardPredictor.predict input
        # (string categoricals, no ratios, no scaling)
    """

    def __init__(
        self,
        model_dir: Path = MODEL_DIR,
        data_dir: Path = DATA_DIR,
        background_n: int = 5000,
        random_state: int = 42,
    ):
        self.model_dir = Path(model_dir)
        self.data_dir = Path(data_dir)
        self.background_n = background_n
        self.random_state = random_state

        self._label_encoders = joblib.load(self.model_dir / "label_encoders.joblib")
        self._scaler = joblib.load(self.model_dir / "scaler.joblib")
        self._xgb = joblib.load(self.model_dir / "xgboost_risk_model.joblib")

        with open(self.model_dir / "xgboost_metadata.json", encoding="utf-8") as f:
            meta = json.load(f)
        self._feature_names: list = meta["feature_names"]
        self._threshold: float = meta["optimal_threshold"]

        self._dice_exp = None  # built lazily

    def _encode_query(self, user_data: dict) -> dict:
        """Encode string categoricals to integers (same as label_encoders)."""
        encoded = user_data.copy()
        for col in CATEGORICAL_COLS:
            if col in encoded:
                encoded[col] = int(
                    self._label_encoders[col].transform([encoded[col]])[0]
                )
        return encoded

    def _load_background(self) -> pd.DataFrame:
        bg_path = self.data_dir / "loans_cleaned.csv"
        if not bg_path.exists():
            raise FileNotFoundError(
                f"Background data not found at {bg_path}. "
                "Run 02_preprocessing.ipynb first, or provide a dice_background.csv "
                "in models/."
            )
        bg = pd.read_csv(bg_path)
        return bg.sample(
            n=min(self.background_n, len(bg)),
            random_state=self.random_state,
        )

    def _build_dice(self):
        import dice_ml

        bg = self._load_background()
        wrapper = _PipelineWrapper(
            self._scaler,
            self._xgb,
            self._feature_names,
            threshold=self._threshold,  # correct threshold from metadata
        )

        all_feature_cols = [c for c in bg.columns if c != "Default"]
        d = dice_ml.Data(
            dataframe=bg,
            continuous_features=all_feature_cols,
            outcome_name="Default",
        )
        m = dice_ml.Model(model=wrapper, backend="sklearn", model_type="classifier")
        return dice_ml.Dice(d, m, method="random")

    def generate_counterfactuals(
        self,
        user_data: dict,
        n_cf: int = 3,
        features_to_vary: Optional[list] = None,
    ) -> list[dict]:
        """Generate what-if scenarios for a rejected applicant.

        Args:
            user_data: Raw applicant data (same format as LoanGuardPredictor.predict).
            n_cf: Number of counterfactual scenarios to generate.
            features_to_vary: Which features can change. Defaults to ACTIONABLE_FEATURES.

        Returns:
            List of dicts, each describing what changed:
            [{"changes": {"LoanAmount": {"from": 80000, "to": 55000}}}, ...]
            Returns [] if no counterfactuals found or DiCE fails.
        """
        if self._dice_exp is None:
            self._dice_exp = self._build_dice()

        features_to_vary = features_to_vary or ACTIONABLE_FEATURES
        encoded = self._encode_query(user_data)
        query_df = pd.DataFrame([encoded]).drop(columns=["Default"], errors="ignore")

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                cf_result = self._dice_exp.generate_counterfactuals(
                    query_df,
                    total_CFs=n_cf,
                    desired_class=0,       # Default=0 means approved
                    features_to_vary=features_to_vary,
                    random_seed=self.random_state,
                )
            cf_df = cf_result.cf_examples_list[0].final_cfs_df
            if cf_df is None or cf_df.empty:
                return []
            return self._format_output(query_df, cf_df, features_to_vary)
        except Exception:
            return []

    def _format_output(
        self,
        original: pd.DataFrame,
        cf_df: pd.DataFrame,
        features_to_vary: list,
    ) -> list[dict]:
        results = []
        for _, cf_row in cf_df.iterrows():
            changes = {}
            for col in features_to_vary:
                if col not in original.columns or col not in cf_df.columns:
                    continue
                orig_val = original[col].iloc[0]
                cf_val = cf_row[col]
                # HasCoSigner is binary; decode back to Yes/No for readability
                if col == "HasCoSigner":
                    if abs(orig_val - cf_val) > 0.5:
                        changes[col] = {
                            "from": "No" if orig_val < 0.5 else "Yes",
                            "to": "No" if cf_val < 0.5 else "Yes",
                        }
                elif abs(float(orig_val) - float(cf_val)) > 1e-4:
                    changes[col] = {
                        "from": round(float(orig_val), 2),
                        "to": round(float(cf_val), 2),
                    }
            if changes:
                results.append({"changes": changes})
        return results
