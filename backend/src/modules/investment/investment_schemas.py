import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel

class InvestmentProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    risk_score: int | None
    risk_level: str | None
    questionnaire_answers: list[dict[str, Any]] | dict[str, Any] | None
    recommended_instruments: list[str] | list[dict[str, Any]] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QuestionnaireAnswer(BaseModel):
    question_id: str
    answer_value: int # e.g. 1-5 where 5 is highest risk

class InvestmentProfileCreate(BaseModel):
    answers: list[QuestionnaireAnswer]

class InvestmentProfileUpdate(BaseModel):
    answers: list[QuestionnaireAnswer]
