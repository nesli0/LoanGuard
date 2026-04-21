import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class Alert(SQLModel, table=True):
    __tablename__ = "alerts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    rule_id: str
    level: str  # 'red', 'yellow', 'green'
    title: str
    message: str

    is_read: bool = Field(default=False)
    is_dismissed: bool = Field(default=False)

    triggered_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
