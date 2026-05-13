import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.models.user_model import User
from src.modules.budget import budget_service
from src.modules.budget.budget_schemas import (
    BudgetPeriodRequest,
    BudgetPeriodResponse,
    EntryResponse,
    EntryUpdate,
    HealthScoreResponse,
)

router = APIRouter(prefix="/budget", tags=["Budget"])


@router.post("")
async def create_or_update_budget(
    body: BudgetPeriodRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[BudgetPeriodResponse]:
    """Belirli bir ay/yıl için bütçe kalemlerini toplu olarak kaydeder (upsert)."""
    period = await budget_service.create_or_update_budget(db, current_user.id, body)
    entries = await budget_service.get_entries_for_period(db, period.id)

    resp = BudgetPeriodResponse.model_validate(period)
    resp.entries = entries

    return ApiResponse(
        message="Bütçe kaydedildi.",
        data=resp,
    )


@router.get("/latest")
async def get_latest_budget(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[BudgetPeriodResponse]:
    """Kullanıcının en son (tarih olarak en yeni) bütçe dönemini getirir."""
    period = await budget_service.get_latest_period(db, current_user.id)
    if not period:
        return ApiResponse(message="Bütçe bulunamadı.", data=None)

    entries = await budget_service.get_entries_for_period(db, period.id)
    resp = BudgetPeriodResponse.model_validate(period)
    resp.entries = entries

    return ApiResponse(
        message="Güncel bütçe getirildi.",
        data=resp,
    )


@router.get("/analysis")
async def get_health_score(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[HealthScoreResponse]:
    """En son bütçe ve hedeflere göre Finansal Sağlık Skoru hesaplar."""
    result = await budget_service.calculate_health_score(db, current_user.id)
    return ApiResponse(
        message="Finansal sağlık skoru hesaplandı.",
        data=HealthScoreResponse(**result),
    )


@router.patch("/entries/{entry_id}")
async def update_budget_entry(
    entry_id: uuid.UUID,
    body: EntryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[EntryResponse]:
    """Tek bir bütçe kalemini günceller (partial update)."""
    entry = await budget_service.update_entry(db, entry_id, current_user.id, body)
    return ApiResponse(
        message="Bütçe kalemi güncellendi.",
        data=EntryResponse.model_validate(entry),
    )


@router.delete("/entries/{entry_id}")
async def delete_budget_entry(
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Tek bir bütçe kalemini siler."""
    await budget_service.delete_entry(db, entry_id, current_user.id)
    return ApiResponse(
        message="Bütçe kalemi silindi.",
        data=None,
    )


@router.get("/{year}/{month}")
async def get_budget_by_period(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[BudgetPeriodResponse]:
    """Belirli bir ay/yıl için bütçeyi getirir. O ay girilmemişse data=None döner."""
    period, entries = await budget_service.get_period_with_entries(
        db, current_user.id, month, year
    )
    if not period:
        return ApiResponse(message="Bu ay için bütçe girilmemiş.", data=None)

    resp = BudgetPeriodResponse.model_validate(period)
    resp.entries = entries

    return ApiResponse(
        message="Bütçe getirildi.",
        data=resp,
    )
