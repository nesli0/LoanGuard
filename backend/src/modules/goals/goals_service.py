import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppException
from src.models.goal_model import Goal
from src.modules.goals.goals_schemas import GoalCreateRequest, GoalUpdateRequest


async def get_goals(db: AsyncSession, user_id: uuid.UUID) -> list[Goal]:
    result = await db.execute(select(Goal).where(Goal.user_id == user_id))
    return list(result.scalars().all())


async def create_goal(db: AsyncSession, user_id: uuid.UUID, data: GoalCreateRequest) -> Goal:
    goal = Goal(**data.model_dump(), user_id=user_id)
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


async def get_goal_by_id(db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID) -> Goal:
    result = await db.execute(
        select(Goal).where(Goal.user_id == user_id, Goal.id == goal_id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise AppException(404, "Hedef bulunamadı.")
    return goal


async def update_goal(
    db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID, data: GoalUpdateRequest
) -> Goal:
    goal = await get_goal_by_id(db, user_id, goal_id)
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(goal, key, value)

    # Otomatik tamamlandı kontrolü
    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True

    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


async def delete_goal(db: AsyncSession, user_id: uuid.UUID, goal_id: uuid.UUID) -> None:
    goal = await get_goal_by_id(db, user_id, goal_id)
    await db.delete(goal)
    await db.commit()
