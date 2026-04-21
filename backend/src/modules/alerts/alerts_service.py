import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.alert_model import Alert
from src.modules.alerts.alerts_schemas import AlertCreate

async def get_user_alerts(db: AsyncSession, user_id: uuid.UUID, include_dismissed: bool = False) -> list[Alert]:
    query = select(Alert).where(Alert.user_id == user_id)
    if not include_dismissed:
        query = query.where(Alert.is_dismissed == False)
    
    query = query.order_by(Alert.triggered_at.desc())
    
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_alert_by_id(db: AsyncSession, alert_id: uuid.UUID) -> Alert | None:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    return result.scalar_one_or_none()

async def create_alert(db: AsyncSession, user_id: uuid.UUID, alert_data: AlertCreate) -> Alert:
    db_alert = Alert(
        user_id=user_id,
        rule_id=alert_data.rule_id,
        level=alert_data.level,
        title=alert_data.title,
        message=alert_data.message
    )
    db.add(db_alert)
    await db.commit()
    await db.refresh(db_alert)
    return db_alert

async def mark_alert_as_read(db: AsyncSession, alert: Alert) -> Alert:
    alert.is_read = True
    await db.commit()
    await db.refresh(alert)
    return alert

async def dismiss_alert(db: AsyncSession, alert: Alert) -> Alert:
    alert.is_dismissed = True
    await db.commit()
    await db.refresh(alert)
    return alert
