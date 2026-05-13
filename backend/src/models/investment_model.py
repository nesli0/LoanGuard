import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


class InvestmentProfile(SQLModel, table=True):
    __tablename__ = "investment_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", unique=True)

    risk_score: int | None = None
    risk_level: str | None = None  # conservative | moderate | aggressive

    questionnaire_answers: list[dict[str, Any]] | dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON)
    )
    recommended_instruments: list[str] | list[dict[str, Any]] | None = Field(
        default=None, sa_column=Column(JSON)
    )

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
