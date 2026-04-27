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


async def evaluate_rules(db: AsyncSession, user_id: uuid.UUID, analysis: dict):
    """
    Analiz sonuçlarına göre kuralları değerlendirir ve gerekirse alarm oluşturur.
    """
    rules = [
        {
            "id": "low_savings",
            "condition": analysis.get("savings_rate", 0) < 10,
            "level": "red",
            "title": "Düşük Tasarruf Oranı",
            "message": f"Tasarruf oranınız %{analysis.get('savings_rate', 0)} seviyesinde. Hedef en az %10 olmalıdır."
        },
        {
            "id": "no_emergency_fund",
            "condition": analysis.get("emergency_fund_ratio", 0) < 1,
            "level": "red",
            "title": "Acil Durum Fonu Yetersiz",
            "message": "Birikimleriniz henüz 1 aylık giderinizi karşılamıyor. En az 3 aylık hedef koymalısınız."
        },
        {
            "id": "high_dti",
            "condition": analysis.get("dti_ratio", 0) > 40,
            "level": "red",
            "title": "Yüksek Borçluluk (DTI) Oranı",
            "message": f"Borç/Gelir oranınız %{analysis.get('dti_ratio', 0)}. %40 eşiğini aşmış durumdasınız."
        },
        {
            "id": "high_fixed_expenses",
            "condition": analysis.get("fixed_expense_ratio", 0) > 60,
            "level": "yellow",
            "title": "Yüksek Sabit Gider",
            "message": f"Giderlerinizin %{analysis.get('fixed_expense_ratio', 0)} kadarı sabit. Esnekliğiniz düşük."
        }
    ]

    for rule in rules:
        if rule["condition"]:
            # Aynı rule_id ile aktif (dismissed=False) bir alarm var mı kontrol et
            check_query = select(Alert).where(
                Alert.user_id == user_id,
                Alert.rule_id == rule["id"],
                Alert.is_dismissed == False
            )
            result = await db.execute(check_query)
            existing = result.scalar_one_or_none()

            if not existing:
                new_alert = Alert(
                    user_id=user_id,
                    rule_id=rule["id"],
                    level=rule["level"],
                    title=rule["title"],
                    message=rule["message"]
                )
                db.add(new_alert)
    
    await db.commit()
