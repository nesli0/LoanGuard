import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.schemas import ApiResponse
from src.core.exceptions import AppException
from src.models.user_model import User
from src.modules.alerts.alerts_schemas import AlertResponse
from src.modules.alerts import alerts_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("/", response_model=ApiResponse[list[AlertResponse]])
async def get_alerts(
    include_dismissed: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alerts = await alerts_service.get_user_alerts(db, current_user.id, include_dismissed)
    return ApiResponse(success=True, data=alerts)

@router.patch("/{alert_id}/read", response_model=ApiResponse[AlertResponse])
async def mark_alert_read(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = await alerts_service.get_alert_by_id(db, alert_id)
    if not alert or alert.user_id != current_user.id:
        raise AppException(status=404, message="Uyarı bulunamadı")
    
    updated_alert = await alerts_service.mark_alert_as_read(db, alert)
    return ApiResponse(success=True, data=updated_alert)

@router.patch("/{alert_id}/dismiss", response_model=ApiResponse[AlertResponse])
async def dismiss_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alert = await alerts_service.get_alert_by_id(db, alert_id)
    if not alert or alert.user_id != current_user.id:
        raise AppException(status=404, message="Uyarı bulunamadı")
    
    updated_alert = await alerts_service.dismiss_alert(db, alert)
    return ApiResponse(success=True, data=updated_alert)
