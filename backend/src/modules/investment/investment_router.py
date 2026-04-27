from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.core.exceptions import AppException
from src.models.user_model import User
from src.modules.investment.investment_schemas import InvestmentProfileResponse, InvestmentProfileCreate, InvestmentProfileUpdate
from src.modules.investment import investment_service

router = APIRouter(prefix="/investment", tags=["Investment"])

@router.get("/profile", response_model=ApiResponse[InvestmentProfileResponse])
async def get_investment_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = await investment_service.get_profile(db, current_user.id)
    if not profile:
        raise AppException(status=404, message="Yatırım profili bulunamadı")
    return ApiResponse(success=True, data=profile)

@router.post("/profile", response_model=ApiResponse[InvestmentProfileResponse])
async def create_investment_profile(
    data: InvestmentProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = await investment_service.get_profile(db, current_user.id)
    if existing:
        raise AppException(status=400, message="Yatırım profili zaten mevcut")
        
    profile = await investment_service.create_profile(db, current_user.id, data)
    return ApiResponse(success=True, data=profile)

@router.put("/profile", response_model=ApiResponse[InvestmentProfileResponse])
async def update_investment_profile(
    data: InvestmentProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = await investment_service.get_profile(db, current_user.id)
    if not profile:
        raise AppException(status=404, message="Yatırım profili bulunamadı")
        
    updated_profile = await investment_service.update_profile(db, profile, data)
    return ApiResponse(success=True, data=updated_profile)
