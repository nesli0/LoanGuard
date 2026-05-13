import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppException
from src.models.financial_model import FinancialEntry, FinancialPeriod
from src.modules.budget.budget_schemas import BudgetPeriodRequest, EntryUpdate
from src.modules.alerts import alerts_service


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


async def get_period_with_entries(
    db: AsyncSession, user_id: uuid.UUID, month: int, year: int
) -> tuple[FinancialPeriod | None, list[FinancialEntry]]:
    """Seçilen ay/yılın dönemini ve entry listesini döner. Dönem yoksa (None, []) döner."""
    period = await get_period(db, user_id, month, year)
    if not period:
        return None, []
    entries = await get_entries_for_period(db, period.id)
    return period, entries


async def update_entry(
    db: AsyncSession, entry_id: uuid.UUID, user_id: uuid.UUID, data: EntryUpdate
) -> FinancialEntry:
    """Tek bir bütçe kalemini partial olarak günceller. Kullanıcı sahipliği doğrulanır."""
    result = await db.execute(
        select(FinancialEntry)
        .join(FinancialPeriod, FinancialEntry.period_id == FinancialPeriod.id)
        .where(FinancialEntry.id == entry_id)
        .where(FinancialPeriod.user_id == user_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise AppException(404, "Bütçe kalemi bulunamadı.")

    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_entry(
    db: AsyncSession, entry_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Tek bir bütçe kalemini siler. Kullanıcı sahipliği doğrulanır."""
    result = await db.execute(
        select(FinancialEntry)
        .join(FinancialPeriod, FinancialEntry.period_id == FinancialPeriod.id)
        .where(FinancialEntry.id == entry_id)
        .where(FinancialPeriod.user_id == user_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise AppException(404, "Bütçe kalemi bulunamadı.")

    await db.delete(entry)
    await db.commit()


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

    # total_savings = gelir - gider (goals'tan değil)
    total_savings = total_income - total_expense

    if total_income == 0:
        total_income = 1.0  # ZeroDivision error önlemek için

    tasarruf_orani = ((total_income - total_expense) / total_income) * 100
    dti = (loan_payments / total_income) * 100

    aylik_gider = total_expense if total_expense > 0 else 1.0
    acil_fon_orani = total_savings / aylik_gider if total_savings > 0 else 0.0

    sabitlik_orani = (fixed_expense / aylik_gider) * 100

    # ── Skor Bileşenleri (Ağırlıklı Ortalama) ──────────────────────────
    # 1. Tasarruf oranı (%30 ağırlık): >%20 → tam puan, <%10 → 0
    if tasarruf_orani >= 20:
        savings_score = 1.0
    elif tasarruf_orani <= 0:
        savings_score = 0.0
    elif tasarruf_orani >= 10:
        savings_score = (tasarruf_orani - 10) / 10.0  # 10-20 arası lineer
    else:
        savings_score = tasarruf_orani / 10.0 * 0.5   # 0-10 arası düşük puan

    # 2. DTI oranı (%25 ağırlık): <%35 → tam puan, >%40 → 0
    if dti <= 35:
        dti_score = 1.0
    elif dti >= 40:
        dti_score = 0.0
    else:
        dti_score = (40 - dti) / 5.0  # 35-40 arası lineer

    # 3. Sabit gider oranı (%15 ağırlık): <%60 → tam puan, >%60 → düşük puan
    if sabitlik_orani <= 60:
        fixed_score = 1.0
    elif sabitlik_orani >= 90:
        fixed_score = 0.0
    else:
        fixed_score = (90 - sabitlik_orani) / 30.0  # 60-90 arası lineer

    # 4. Acil fon oranı (%20 ağırlık): >3 ay → tam puan, 0 → 0 puan
    if acil_fon_orani >= 3:
        emergency_score = 1.0
    elif acil_fon_orani <= 0:
        emergency_score = 0.0
    else:
        emergency_score = acil_fon_orani / 3.0  # 0-3 arası lineer

    # 5. Sabit bonus bileşen (%10 ağırlık): veri var mı?
    data_completeness_score = 1.0 if (total_income > 1.0 and len(entries) > 0) else 0.5

    score = (
        savings_score * 30 +
        dti_score * 25 +
        emergency_score * 20 +
        fixed_score * 15 +
        data_completeness_score * 10
    )

    result = {
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
            "total_savings": round(total_savings, 2),
        }
    }

    await alerts_service.evaluate_rules(db, user_id, result)

    return result

