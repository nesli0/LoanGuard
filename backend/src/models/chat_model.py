import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel


ChatRole = Literal["user", "assistant", "system"]


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_history"

    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'assistant', 'system')", name="chk_chat_role"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    role: str  # 'user' | 'assistant' | 'system'
    content: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
