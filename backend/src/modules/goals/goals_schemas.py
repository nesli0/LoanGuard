import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class GoalBase(BaseModel):
    title: str = Field(..., description="Hedefin adı")
    category: Literal["acil_fon", "tatil", "ev", "araç", "eğitim", "diğer"] | None = None
    description: str | None = None
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0.0, ge=0)
    monthly_target: float | None = Field(default=None, ge=0)
    deadline: date | None = None
    is_completed: bool = False


class GoalCreateRequest(GoalBase):
    pass


class GoalUpdateRequest(BaseModel):
    title: str | None = None
    category: Literal["acil_fon", "tatil", "ev", "araç", "eğitim", "diğer"] | None = None
    description: str | None = None
    target_amount: float | None = Field(default=None, gt=0)
    current_amount: float | None = Field(default=None, ge=0)
    monthly_target: float | None = Field(default=None, ge=0)
    deadline: date | None = None
    is_completed: bool | None = None


class GoalResponse(GoalBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
