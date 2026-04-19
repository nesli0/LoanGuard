"""
Faiz Oranı Optimizasyonu – Stage 3

Bu modül src/pipeline/interest_rate.py olarak kullanılmak üzere 
05_interest_rate_optimization.ipynb'den çıkarılmıştır.
"""
import numpy as np


def compute_interest_rate(
    risk_score: float,
    base_rate: float = 0.05,
    risk_premium_max: float = 0.15,
    method: str = "linear",
) -> float:
    """Risk skorunu faiz oranına çevirir.

    Args:
        risk_score: [0.0, 1.0] aralığında XGBoost tahmin olasılığı.
        base_rate: Minimum faiz oranı (varsayılan %5).
        risk_premium_max: Maksimum ek prim (varsayılan %15).
        method: 'linear' | 'sigmoid' | 'quadratic'

    Returns:
        Faiz oranı (ondalık, ör. 0.12 = %12).
    """
    s = float(np.clip(risk_score, 0.0, 1.0))

    if method == "linear":
        premium = s
    elif method == "sigmoid":
        premium = 1.0 / (1.0 + np.exp(-10.0 * (s - 0.5)))
    elif method == "quadratic":
        premium = s ** 2
    else:
        raise ValueError(f"Bilinmeyen yöntem: {method}")

    return base_rate + risk_premium_max * premium
