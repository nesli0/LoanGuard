from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.models.user_model import User
from src.modules.profile import profile_service
from src.modules.profile.profile_schemas import ProfileResponse, ProfileUpdateRequest

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("")
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ProfileResponse]:
    """Kullanıcının kendi profil bilgilerini getirir."""
    profile = await profile_service.get_or_create_profile(db, current_user.id)
    return ApiResponse(
        message="Profil bilgileri getirildi.",
        data=ProfileResponse.model_validate(profile),
    )


@router.put("")
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ProfileResponse]:
    """Kullanıcının kendi profil bilgilerini günceller."""
    update_data = body.model_dump(exclude_unset=True)
    profile = await profile_service.update_profile(db, current_user.id, update_data)
    
    return ApiResponse(
        message="Profil başarıyla güncellendi.",
        data=ProfileResponse.model_validate(profile),
    )
