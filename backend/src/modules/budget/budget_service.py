import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppException
from src.models.financial_model import FinancialEntry, FinancialPeriod
from src.models.goal_model import Goal
from src.modules.budget.budget_schemas import BudgetPeriodRequest


async def get_period(db: AsyncSession, user_id: uuid.UUID, month: int, year: int) -> FinancialPeriod | None:
    result = await db.execute(
        select(FinancialPeriod)
        .where(FinancialPeriod.user_id == user_id)
        .where(FinancialPeriod.month == month)
        .where(FinancialPeriod.year == year)
    )
    return result.scalar_one_or_none()


async def get_latest_period(db: AsyncSession, user_id: uuid.UUID) -> FinancialPeriod | None:
    result = await db.execute(
        select(FinancialPeriod)
        .where(FinancialPeriod.user_id == user_id)
        .order_by(FinancialPeriod.year.desc(), FinancialPeriod.month.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_entries_for_period(db: AsyncSession, period_id: uuid.UUID) -> list[FinancialEntry]:
    result = await db.execute(
        select(FinancialEntry).where(FinancialEntry.period_id == period_id)
    )
    return list(result.scalars().all())


async def create_or_update_budget(db: AsyncSession, user_id: uuid.UUID, data: BudgetPeriodRequest) -> FinancialPeriod:
    period = await get_period(db, user_id, data.month, data.year)
    
    if not period:
        period = FinancialPeriod(user_id=user_id, month=data.month, year=data.year)
        db.add(period)
        await db.flush()  # ID alabilmek için
    else:
        # Eski entryleri silip yenilerini ekleyebiliriz (basit yaklaşım)
        existing_entries = await get_entries_for_period(db, period.id)
        for entry in existing_entries:
            await db.delete(entry)
        await db.flush()

    for item in data.entries:
        entry = FinancialEntry(
            period_id=period.id,
            type=item.type,
            category=item.category,
            amount=item.amount,
            is_fixed=item.is_fixed,
            is_loan_payment=item.is_loan_payment,
            note=item.note
        )
        db.add(entry)

    await db.commit()
    await db.refresh(period)
    return period


async def calculate_health_score(db: AsyncSession, user_id: uuid.UUID) -> dict:
    latest_period = await get_latest_period(db, user_id)
    if not latest_period:
        raise AppException(404, "Bütçe verisi bulunamadı.")

    entries = await get_entries_for_period(db, latest_period.id)

    total_income = sum(e.amount for e in entries if e.type == "income")
    total_expense = sum(e.amount for e in entries if e.type == "expense")
    fixed_expense = sum(e.amount for e in entries if e.type == "expense" and e.is_fixed)
    loan_payments = sum(e.amount for e in entries if e.type == "expense" and e.is_loan_payment)

    # Acil fonu bulmak için goals tablosuna bak ("acil_fon" kategorisi)
    goals_result = await db.execute(
        select(Goal).where(Goal.user_id == user_id, Goal.category == "acil_fon")
    )
    emergency_goals = list(goals_result.scalars().all())
    total_savings = sum(g.current_amount for g in emergency_goals)

    if total_income == 0:
        total_income = 1.0  # ZeroDivision error önlemek için

    tasarruf_orani = ((total_income - total_expense) / total_income) * 100
    dti = (loan_payments / total_income) * 100
    
    aylik_gider = total_expense if total_expense > 0 else 1.0
    acil_fon_orani = total_savings / aylik_gider

    sabitlik_orani = (fixed_expense / aylik_gider) * 100

    # Skor hesaplama formülü (Implementation planındaki ağırlıklar)
    score = (
        min(tasarruf_orani / 20.0, 1.0) * 30 +          # %30 ağırlık (> %20 ideal)
        max(1.0 - (dti / 35.0), 0.0) * 25 +             # %25 ağırlık (< %35 ideal)
        min(acil_fon_orani / 3.0, 1.0) * 20 +           # %20 ağırlık (> 3 ay ideal)
        max(1.0 - (sabitlik_orani / 60.0), 0.0) * 15 +  # %15 ağırlık (< %60 ideal)
        1.0 * 10                                        # %10 ağırlık (şimdilik sapma hesabını sabitliyoruz)
    ) * 100

    return {
        "score": round(max(0, min(100, score)), 1),
        "savings_rate": round(tasarruf_orani, 2),
        "dti_ratio": round(dti, 2),
        "emergency_fund_ratio": round(acil_fon_orani, 2),
        "fixed_expense_ratio": round(sabitlik_orani, 2),
        "details": {
            "total_income": total_income,
            "total_expense": total_expense,
            "fixed_expense": fixed_expense,
            "loan_payments": loan_payments,
            "total_savings": total_savings
        }
    }
