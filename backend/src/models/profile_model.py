import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", unique=True, index=True)

    # Kimlik
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None

    # Demografik (ML & analiz için)
    age: int | None = None
    marital_status: str | None = None    # bekar | evli | dul | boşanmış
    employment_type: str | None = None   # maaşlı | serbest | işsiz | emekli
    education: str | None = None         # ilkokul | lise | üniversite | yükseklisans
    dependents: int = Field(default=0)
    city: str | None = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


