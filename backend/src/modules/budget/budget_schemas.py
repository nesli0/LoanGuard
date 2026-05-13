import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EntryCreate(BaseModel):
    type: Literal["income", "expense"] = Field(..., description="income veya expense")
    category: str = Field(..., description="Maaş, Kira, Fatura vs.")
    amount: float = Field(..., gt=0, description="Tutar")
    is_fixed: bool = Field(default=False, description="Sabit gider mi?")
    is_loan_payment: bool = Field(default=False, description="Kredi taksiti mi?")
    note: str | None = Field(default=None, description="Not")


class EntryUpdate(BaseModel):
    """Partial update — sadece gönderilen alanlar güncellenir."""
    category: str | None = Field(default=None)
    amount: float | None = Field(default=None, gt=0)
    is_fixed: bool | None = Field(default=None)
    is_loan_payment: bool | None = Field(default=None)
    note: str | None = Field(default=None)


class BudgetPeriodRequest(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    entries: list[EntryCreate]


class EntryResponse(BaseModel):
    id: uuid.UUID
    period_id: uuid.UUID
    type: str
    category: str
    amount: float
    is_fixed: bool
    is_loan_payment: bool
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BudgetPeriodResponse(BaseModel):
    id: uuid.UUID
    month: int
    year: int
    entries: list[EntryResponse] = []

    model_config = {"from_attributes": True}


class HealthScoreResponse(BaseModel):
    score: float
    savings_rate: float
    dti_ratio: float
    emergency_fund_ratio: float
    fixed_expense_ratio: float
    details: dict
