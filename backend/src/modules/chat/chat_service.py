import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.chat_model import ChatMessage
import asyncio

async def get_user_chat_history(db: AsyncSession, user_id: uuid.UUID) -> list[ChatMessage]:
    query = select(ChatMessage).where(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.asc())
    result = await db.execute(query)
    return list(result.scalars().all())

async def save_message(db: AsyncSession, user_id: uuid.UUID, role: str, content: str) -> ChatMessage:
    db_message = ChatMessage(user_id=user_id, role=role, content=content)
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)
    return db_message

from src.models.profile_model import Profile
from src.models.financial_model import FinancialPeriod, FinancialEntry
from src.models.report_model import Report
from src.models.goal_model import Goal
from src.models.investment_model import InvestmentProfile
from src.core.llm_service import generate_financial_advice

async def generate_ai_response(db: AsyncSession, user_id: uuid.UUID, user_message: str) -> str:
    # 1. Fetch User Data
    profile_result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    
    # Financial Period (Latest)
    period_result = await db.execute(
        select(FinancialPeriod)
        .where(FinancialPeriod.user_id == user_id)
        .order_by(FinancialPeriod.year.desc(), FinancialPeriod.month.desc())
        .limit(1)
    )
    latest_period = period_result.scalar_one_or_none()
    
    income = 0.0
    expense = 0.0
    if latest_period:
        entries_result = await db.execute(select(FinancialEntry).where(FinancialEntry.period_id == latest_period.id))
        entries = entries_result.scalars().all()
        income = sum(e.amount for e in entries if e.type == "income")
        expense = sum(e.amount for e in entries if e.type == "expense")
    
    # Savings Rate
    savings_rate = 0.0
    if income > 0:
        savings_rate = round(((income - expense) / income) * 100, 2)
        
    # Health Score
    report_result = await db.execute(
        select(Report)
        .where(Report.user_id == user_id)
        .order_by(Report.year.desc(), Report.month.desc())
        .limit(1)
    )
    report = report_result.scalar_one_or_none()
    health_score = report.health_score if report and report.health_score else 0.0
    
    # Goals
    goals_result = await db.execute(select(Goal).where(Goal.user_id == user_id).where(Goal.is_completed == False))
    goals = goals_result.scalars().all()
    goals_str = ", ".join([g.title for g in goals]) if goals else "Belirtilmemiş"
    
    # Risk Level
    inv_result = await db.execute(select(InvestmentProfile).where(InvestmentProfile.user_id == user_id))
    inv_profile = inv_result.scalar_one_or_none()
    risk_level = inv_profile.risk_level if inv_profile and inv_profile.risk_level else "Bilinmiyor"
    
    user_data = {
        "age": profile.age if profile else "Bilinmiyor",
        "city": profile.city if profile else "Bilinmiyor",
        "income": income,
        "expense": expense,
        "savings_rate": savings_rate,
        "health_score": health_score,
        "goals": goals_str,
        "risk_level": risk_level,
    }
    
    # 2. Fetch Chat History (last 10 messages for context)
    history_query = select(ChatMessage).where(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.desc()).limit(10)
    history_result = await db.execute(history_query)
    messages = list(history_result.scalars().all())
    messages.reverse() # chronological order
    
    chat_history = [{"role": msg.role, "content": msg.content} for msg in messages if msg.role in ["user", "assistant"]]
    
    # 3. Call LLM
    ai_response_text = await generate_financial_advice(user_data, user_message, chat_history)
    
    return ai_response_text
