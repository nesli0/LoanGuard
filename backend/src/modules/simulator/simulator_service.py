from src.modules.simulator.simulator_schemas import LoanSimulationRequest, SimulationResult

def calculate_loan_simulation(request: LoanSimulationRequest) -> SimulationResult:
    # Monthly interest rate
    r = request.interest_rate / 100 / 12
    n = request.months
    P = request.amount

    if r == 0:
        monthly_payment = P / n
    else:
        # Amortization formula: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
        monthly_payment = P * (r * (1 + r)**n) / ((1 + r)**n - 1)
        
    total_payment = monthly_payment * n
    total_interest = total_payment - P

    # DTI Calculations (Debt-to-Income ratio)
    old_dti = 0.0
    if request.current_income > 0:
        old_dti = (request.current_debt_payments / request.current_income) * 100

    new_debt_payments = request.current_debt_payments + monthly_payment
    new_dti = 0.0
    if request.current_income > 0:
        new_dti = (new_debt_payments / request.current_income) * 100

    # Assuming 40% is the safe threshold for DTI
    is_dti_safe = new_dti <= 40.0

    return SimulationResult(
        monthly_payment=round(monthly_payment, 2),
        total_payment=round(total_payment, 2),
        total_interest=round(total_interest, 2),
        old_dti=round(old_dti, 2),
        new_dti=round(new_dti, 2),
        is_dti_safe=is_dti_safe
    )
