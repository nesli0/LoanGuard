import uuid
from datetime import datetime
from pydantic import BaseModel, Field

class ReportResponse(BaseModel):
    id: uuid.UUID
    month: int
    year: int
    health_score: float
    # Frontend'in doğrudan beklediği alanları düzleştiriyoruz
    savings_rate: float
    dti_ratio: float
    total_income: float
    total_expense: float
    insights: list[str]
    created_at: datetime = Field(alias="generated_at")

    class Config:
        from_attributes = True
        populate_by_name = True

class ReportGenerateRequest(BaseModel):
    month: int
    year: int
