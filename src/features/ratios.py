"""Financial ratio computation — single source of truth.

This module is imported by both predictor.py and dice_explainer.py to
avoid code duplication. Any formula change MUST be made here only.

Formulas mirror 02b_feature_engineering.ipynb exactly:
  - LoanToIncome      = LoanAmount / Income
  - PaymentToIncome   = monthly_payment / (Income / 12)
  - CreditAgePerLine  = MonthsEmployed / (NumCreditLines + 1)
  - TotalDebtBurden   = (monthly_payment * LoanTerm) / Income

Monthly payment uses the standard annuity formula (PMT):
  PMT = P * r / (1 - (1 + r)^-n)   where r = InterestRate / 1200, n = LoanTerm
  Edge case: if r ≈ 0, PMT = P / n  (zero-interest loan)
"""
import numpy as np
import pandas as pd


def add_ratios(df: pd.DataFrame) -> pd.DataFrame:
    """Compute 4 financial ratios and append them to *df*.

    Args:
        df: DataFrame containing at minimum the columns:
            InterestRate, LoanTerm, LoanAmount, Income,
            MonthsEmployed, NumCreditLines.
            All values must be numeric (label-encoded if categorical).

    Returns:
        A new DataFrame (copy) with 4 extra columns:
        LoanToIncome, PaymentToIncome, CreditAgePerLine, TotalDebtBurden.
    """
    df = df.copy()

    r = df["InterestRate"] / 1200          # monthly rate
    n = df["LoanTerm"]                     # months
    P = df["LoanAmount"]                   # principal
    monthly_income = df["Income"] / 12

    # Annuity PMT — zero-rate guard
    monthly_pmt = np.where(
        r < 1e-10,
        P / np.maximum(n, 1),
        P * r / (1 - (1 + r) ** (-n)),
    )

    df["LoanToIncome"]     = P / np.maximum(df["Income"], 1)
    df["PaymentToIncome"]  = monthly_pmt / np.maximum(monthly_income, 1)
    df["CreditAgePerLine"] = df["MonthsEmployed"] / (df["NumCreditLines"] + 1)
    df["TotalDebtBurden"]  = (monthly_pmt * n) / np.maximum(df["Income"], 1)

    return df
