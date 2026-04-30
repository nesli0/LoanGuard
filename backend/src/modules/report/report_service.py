import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.report_model import Report
from src.modules.report.report_schemas import ReportGenerateRequest
from src.modules.budget import budget_service

async def get_report(db: AsyncSession, user_id: uuid.UUID, month: int, year: int) -> Report | None:
    query = select(Report).where(
        Report.user_id == user_id,
        Report.month == month,
        Report.year == year
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def generate_report(db: AsyncSession, user_id: uuid.UUID, request: ReportGenerateRequest) -> Report:
    # First check if it exists
    existing = await get_report(db, user_id, request.month, request.year)
    
    # Run the budget analysis for this month (we will reuse the budget_service functionality)
    analysis = await budget_service.calculate_health_score(db, user_id)
    
    health_score = analysis.get("score", 0.0)
    details = analysis.get("details", {})
    summary_data = {
        "dti": analysis.get("dti_ratio", 0.0),
        "savings_rate": analysis.get("savings_rate", 0.0),
        "total_income": details.get("total_income", 0.0),
        "total_expense": details.get("total_expense", 0.0),
    }
    
    # Simple insights based on score
    insights = []
    if health_score < 40:
        insights.append("Finansal sağlığınız risk altında. Sabit giderlerinizi azaltmayı düşünün.")
    elif health_score < 70:
        insights.append("Finansal durumunuz orta seviyede. Acil durum fonunuzu artırabilirsiniz.")
    else:
        insights.append("Harika iş çıkarıyorsunuz! Finansal sağlığınız çok iyi durumda.")

    if existing:
        existing.health_score = health_score
        existing.summary_data = summary_data
        existing.insights = insights
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        new_report = Report(
            user_id=user_id,
            month=request.month,
            year=request.year,
            health_score=health_score,
            summary_data=summary_data,
            insights=insights
        )
        db.add(new_report)
        await db.commit()
        await db.refresh(new_report)
        return new_report
