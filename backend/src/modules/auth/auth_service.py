import uuid

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.exceptions import AppException
from src.models.user_model import User
from src.modules.auth.auth_constants import (
    AUTH_EMAIL_ALREADY_EXISTS,
    AUTH_INVALID_CREDENTIALS,
)
from src.modules.auth.auth_utils import hash_password, verify_password


async def register_user(db: AsyncSession, email: str, username: str, password: str) -> User:
    """Yeni kullanıcı oluştur. Email veya username zaten varsa 409 fırlatır."""
    # Email kontrolü
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        raise AppException(409, "Bu email zaten kayıtlı.", AUTH_EMAIL_ALREADY_EXISTS)

    # Username kontrolü
    result_username = await db.execute(select(User).where(User.username == username))
    existing_username = result_username.scalar_one_or_none()
    if existing_username:
        raise AppException(409, "Bu kullanıcı adı (username) zaten kullanılıyor.", AUTH_EMAIL_ALREADY_EXISTS)

    # Yeni kullanıcı oluştur
    user = User(
        email=email,
        username=username,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, identifier: str, password: str) -> User:
    """Email veya username + parola doğrula, User döndür. Başarısızsa 401 fırlatır."""
    result = await db.execute(
        select(User).where(
            or_(User.email == identifier, User.username == identifier)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise AppException(401, "Email/Kullanıcı adı veya parola hatalı.", AUTH_INVALID_CREDENTIALS)

    return user


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    """ID ile kullanıcı getir."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return None

    result = await db.execute(select(User).where(User.id == uid))
    return result.scalar_one_or_none()
