import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Report(SQLModel, table=True):
    __tablename__ = "reports"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id")

    month: int
    year: int

    health_score: float | None = None

    summary_data: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    insights: list[str] | list[dict[str, Any]] | None = Field(default=None, sa_column=Column(JSON))

    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
