from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.middlewares.rate_limiter import limiter

from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.models.user_model import User
from src.modules.auth import auth_service
from src.modules.auth.auth_schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserMeResponse,
)
from src.modules.auth.auth_utils import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[UserMeResponse]:
    """Yeni kullanıcı kaydı. Email + parola alır, bcrypt ile hashler."""
    user = await auth_service.register_user(db, body.email, body.username, body.password)
    return ApiResponse(
        message="Kayıt başarılı.",
        data=UserMeResponse.model_validate(user),
    )


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[TokenResponse]:
    """Giriş — JWT token döner (7 gün geçerli)."""
    user = await auth_service.authenticate_user(db, body.username_or_email, body.password)
    token = create_access_token(str(user.id))
    return ApiResponse(
        message="Giriş başarılı.",
        data=TokenResponse(access_token=token),
    )


@router.get("/me")
async def me(
    current_user: User = Depends(get_current_user),
) -> ApiResponse[UserMeResponse]:
    """Oturum bilgisi — Authorization: Bearer <token> gerektirir."""
    return ApiResponse(
        message="Kullanıcı bilgisi.",
        data=UserMeResponse.model_validate(current_user),
    )
