from datetime import UTC, datetime, timedelta

import bcrypt
from jose import jwt

from src.modules.auth.auth_config import auth_settings


def hash_password(password: str) -> str:
    """bcrypt ile parola hashle."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Düz parola ile bcrypt hash'i karşılaştır."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str) -> str:
    """Kullanıcı ID'si ile JWT üret (7 gün geçerli)."""
    expire = datetime.now(UTC) + timedelta(days=auth_settings.ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(
        payload,
        auth_settings.JWT_SECRET_KEY,
        algorithm=auth_settings.JWT_ALGORITHM,
    )


def decode_token(token: str) -> dict:
    """JWT token'ı decode et ve payload döndür. Hatalıysa JWTError fırlatır."""
    return jwt.decode(
        token,
        auth_settings.JWT_SECRET_KEY,
        algorithms=[auth_settings.JWT_ALGORITHM],
    )
