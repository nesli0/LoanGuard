import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel

class ReportResponse(BaseModel):
    id: uuid.UUID
    month: int
    year: int
    health_score: float | None
    summary_data: dict[str, Any] | None
    insights: list[str] | list[dict[str, Any]] | None
    generated_at: datetime

    class Config:
        from_attributes = True

class ReportGenerateRequest(BaseModel):
    month: int
    year: int
