from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.core.database import get_db
from src.core.exceptions import AppException
from src.models.user_model import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        from src.modules.auth.auth_utils import decode_token

        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if not user_id:
            raise AppException(401, "Geçersiz token: kullanıcı ID bulunamadı", "INVALID_TOKEN")
    except JWTError:
        raise AppException(401, "Geçersiz veya süresi dolmuş token", "INVALID_TOKEN")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise AppException(401, "Kullanıcı bulunamadı", "USER_NOT_FOUND")

    return user
