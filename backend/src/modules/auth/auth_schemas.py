import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from src.modules.auth.auth_constants import MIN_PASSWORD_LENGTH


# ── Request Schemas ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"Parola en az {MIN_PASSWORD_LENGTH} karakter olmalıdır.")
        return v


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


# ── Response Schemas ─────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserMeResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}
