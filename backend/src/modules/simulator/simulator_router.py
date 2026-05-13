from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.exceptions import AppException
from src.core.schemas import ApiResponse
from src.modules.simulator.simulator_schemas import LoanSimulationRequest, SimulationResult
from src.modules.simulator import simulator_service
from src.core.dependencies import get_current_user
from src.models.user_model import User
from src.models.financial_model import FinancialEntry, FinancialPeriod

router = APIRouter(prefix="/simulator", tags=["Simulator"])

@router.post("/loan", response_model=ApiResponse[SimulationResult])
async def simulate_loan(
    request: LoanSimulationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    latest_period_result = await db.execute(
        select(FinancialPeriod)
        .where(FinancialPeriod.user_id == current_user.id)
        .order_by(FinancialPeriod.year.desc(), FinancialPeriod.month.desc())
        .limit(1)
    )
    latest_period = latest_period_result.scalar_one_or_none()

    if not latest_period:
        raise AppException(
            400,
            "Simülatörü kullanabilmek için önce bütçe bilgilerinizi girmeniz gerekiyor.",
            "BUDGET_REQUIRED",
            data={"redirect": "/budget"}
        )

    entries_result = await db.execute(
        select(FinancialEntry).where(FinancialEntry.period_id == latest_period.id)
    )
    entries = entries_result.scalars().all()

    total_income = sum(e.amount for e in entries if e.type == "income")
    loan_payments = sum(e.amount for e in entries if e.is_loan_payment)

    if total_income == 0.0:
        raise AppException(
            400,
            "Simülatörü kullanabilmek için önce bütçe bilgilerinizi girmeniz gerekiyor.",
            "BUDGET_REQUIRED",
            data={"redirect": "/budget"}
        )

    request.current_income = total_income
    request.current_debt_payments = loan_payments

    result = simulator_service.calculate_loan_simulation(request)
    return ApiResponse(message="Simülasyon hesaplandı.", data=result)
