from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.core.exceptions import AppException
from src.models.user_model import User
from src.modules.report.report_schemas import ReportResponse, ReportGenerateRequest
from src.modules.report import report_service

router = APIRouter(prefix="/report", tags=["Report"])

@router.get("/{year}/{month}", response_model=ApiResponse[ReportResponse])
async def get_report(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = await report_service.get_report(db, current_user.id, month, year)
    if not report:
        raise AppException(status=404, message="Rapor bulunamadı")
    return ApiResponse(success=True, data=report)

@router.post("/generate", response_model=ApiResponse[ReportResponse])
async def generate_report(
    request: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = await report_service.generate_report(db, current_user.id, request)
    return ApiResponse(success=True, data=report)
