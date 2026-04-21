import uuid
from datetime import UTC, date, datetime

from sqlmodel import Field, SQLModel


class Goal(SQLModel, table=True):
    __tablename__ = "goals"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    title: str
    category: str | None = None      # acil_fon | tatil | ev | araç | eğitim | diğer
    description: str | None = None

    target_amount: float
    current_amount: float = Field(default=0.0)
    monthly_target: float | None = None  # Aylık katkı hedefi

    deadline: date | None = None
    is_completed: bool = Field(default=False)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
