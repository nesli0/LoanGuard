import uuid
from datetime import UTC, datetime

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel


class FinancialPeriod(SQLModel, table=True):
    __tablename__ = "financial_periods"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class FinancialEntry(SQLModel, table=True):
    __tablename__ = "financial_entries"

    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense')", name="chk_entry_type"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    period_id: uuid.UUID = Field(foreign_key="financial_periods.id", index=True)

    type: str                           # 'income' | 'expense'
    category: str
    amount: float = Field(default=0.0)

    # Analiz ve algoritma için kritik
    is_fixed: bool = Field(default=False)        # Kira, fatura → sabitlik oranı hesabı
    is_loan_payment: bool = Field(default=False) # Kredi taksiti → DTI hesabı

    note: str | None = None             # Kullanıcı notu

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
