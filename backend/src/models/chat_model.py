import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel


ChatRole = Literal["user", "assistant", "system"]


class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    title: str = Field(default="Yeni Sohbet")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_history"

    __table_args__ = (
        CheckConstraint(
            "role IN ('user', 'assistant', 'system')", name="chk_chat_role"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    session_id: uuid.UUID = Field(foreign_key="chat_sessions.id", index=True, nullable=True) # nullable for backward compatibility
    role: str  # 'user' | 'assistant' | 'system'
    content: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
