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

def map_report_to_response(report) -> ReportResponse:
    """DB modelini frontend'in beklediği düz formata çevirir."""
    summary = report.summary_data or {}
    return ReportResponse(
        id=report.id,
        month=report.month,
        year=report.year,
        health_score=report.health_score or 0.0,
        savings_rate=summary.get("savings_rate", 0.0),
        dti_ratio=summary.get("dti", 0.0),  # Backend 'dti' olarak saklıyor
        total_income=summary.get("total_income", 0.0),
        total_expense=summary.get("total_expense", 0.0),
        insights=report.insights or [],
        generated_at=report.generated_at
    )

@router.get("/{year}/{month}")
async def get_report(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ApiResponse[ReportResponse]:
    report = await report_service.get_report(db, current_user.id, month, year)
    if not report:
        raise AppException(status=404, message="Rapor bulunamadı")
    
    return ApiResponse(success=True, data=map_report_to_response(report))

@router.post("/generate")
async def generate_report(
    request: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ApiResponse[ReportResponse]:
    report = await report_service.generate_report(db, current_user.id, request)
    return ApiResponse(success=True, data=map_report_to_response(report))
