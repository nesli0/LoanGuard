from pydantic import BaseModel

class LoanSimulationRequest(BaseModel):
    amount: float
    months: int
    interest_rate: float
    current_income: float
    current_debt_payments: float

class SimulationResult(BaseModel):
    monthly_payment: float
    total_payment: float
    total_interest: float
    old_dti: float
    new_dti: float
    is_dti_safe: bool
