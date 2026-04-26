"""Per-request SHAP explanations for the XGBoost risk model.

Separate from the batch/global SHAP analysis done in 03_xgboost_risk_model.ipynb.
That notebook answers "what did the model learn?" (development-time).
This module answers "why was this specific application rejected?" (request-time).
"""
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
import shap

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "models"


class SHAPExplainer:
    """Cached SHAP TreeExplainer for per-request explanations.

    TreeExplainer initialization is expensive (~100ms for this model).
    The instance should be created once and reused across requests.
    LoanGuardPredictor already does this internally; use this class
    only when you need SHAP without the full predictor.

    Usage:
        explainer = SHAPExplainer()
        top3 = explainer.explain_top_n(df_preprocessed, n=3)
    """

    def __init__(self, model_dir: Path = MODEL_DIR):
        self._xgb_model = joblib.load(Path(model_dir) / "xgboost_risk_model.joblib")
        self._explainer: Optional[shap.TreeExplainer] = None

    def _get_explainer(self) -> shap.TreeExplainer:
        if self._explainer is None:
            self._explainer = shap.TreeExplainer(self._xgb_model)
        return self._explainer

    def explain_top_n(self, X: pd.DataFrame, n: int = 3) -> list[dict]:
        """Top-n most influential features for a single preprocessed row.

        Args:
            X: Single-row DataFrame (already encoded, ratio-computed, scaled).
               Must use the same column order as training (feature_names in
               xgboost_metadata.json).
            n: Number of top features to return.

        Returns:
            List of dicts sorted by |SHAP| descending:
            [{"feature": str, "direction": "+" | "-", "shap_value": float}, ...]
        """
        explainer = self._get_explainer()
        shap_vals = explainer.shap_values(X)[0]
        top_idx = np.argsort(np.abs(shap_vals))[::-1][:n]
        return [
            {
                "feature": X.columns[i],
                "direction": "+" if shap_vals[i] > 0 else "-",
                "shap_value": round(float(shap_vals[i]), 4),
            }
            for i in top_idx
        ]

    def explain_batch(self, X: pd.DataFrame, n: int = 3) -> list[list[dict]]:
        """Top-n SHAP features for each row in X (batch version).

        Args:
            X: Multi-row preprocessed DataFrame.
            n: Number of top features per row.

        Returns:
            List of lists (one per row), each matching explain_top_n format.
        """
        explainer = self._get_explainer()
        shap_vals_all = explainer.shap_values(X)
        results = []
        for row_shap in shap_vals_all:
            top_idx = np.argsort(np.abs(row_shap))[::-1][:n]
            results.append([
                {
                    "feature": X.columns[i],
                    "direction": "+" if row_shap[i] > 0 else "-",
                    "shap_value": round(float(row_shap[i]), 4),
                }
                for i in top_idx
            ])
        return results
