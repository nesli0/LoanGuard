import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.models.user_model import User
from src.modules.goals import goals_service
from src.modules.goals.goals_schemas import GoalCreateRequest, GoalResponse, GoalUpdateRequest

router = APIRouter(prefix="/goals", tags=["Goals"])


@router.get("")
async def get_all_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[GoalResponse]]:
    """Kullanıcının tüm hedeflerini listeler."""
    goals = await goals_service.get_goals(db, current_user.id)
    return ApiResponse(
        message="Hedefler listelendi.",
        data=[GoalResponse.model_validate(g) for g in goals],
    )


@router.post("")
async def create_goal(
    body: GoalCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[GoalResponse]:
    """Yeni bir finansal hedef oluşturur."""
    goal = await goals_service.create_goal(db, current_user.id, body)
    return ApiResponse(
        message="Hedef oluşturuldu.",
        data=GoalResponse.model_validate(goal),
    )


@router.put("/{goal_id}")
async def update_goal(
    goal_id: uuid.UUID,
    body: GoalUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[GoalResponse]:
    """Mevcut bir hedefi günceller."""
    goal = await goals_service.update_goal(db, current_user.id, goal_id, body)
    return ApiResponse(
        message="Hedef güncellendi.",
        data=GoalResponse.model_validate(goal),
    )


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[None]:
    """Mevcut bir hedefi siler."""
    await goals_service.delete_goal(db, current_user.id, goal_id)
    return ApiResponse(message="Hedef silindi.", data=None)
