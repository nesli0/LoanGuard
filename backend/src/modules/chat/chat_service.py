import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from src.models.chat_model import ChatMessage, ChatSession
import asyncio

async def get_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> list[ChatSession]:
    query = select(ChatSession).where(ChatSession.user_id == user_id).order_by(ChatSession.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())

async def create_chat_session(db: AsyncSession, user_id: uuid.UUID, title: str = "Yeni Sohbet") -> ChatSession:
    session = ChatSession(user_id=user_id, title=title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

async def get_user_chat_history(db: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID | None = None) -> list[ChatMessage]:
    query = select(ChatMessage).where(ChatMessage.user_id == user_id)
    if session_id:
        query = query.where(ChatMessage.session_id == session_id)
    query = query.order_by(ChatMessage.created_at.asc())
    result = await db.execute(query)
    return list(result.scalars().all())

async def save_message(db: AsyncSession, user_id: uuid.UUID, role: str, content: str, session_id: uuid.UUID | None = None) -> ChatMessage:
    # If session_id is provided, use it. Otherwise, this might be a legacy message or we should create a session
    db_message = ChatMessage(user_id=user_id, role=role, content=content, session_id=session_id)
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)
    
    # Update session title if it's the first message and title is default
    if session_id and role == "user":
        session_res = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
        session = session_res.scalar_one_or_none()
        if session and session.title == "Yeni Sohbet":
            session.title = content[:30] + "..." if len(content) > 30 else content
            db.add(session)
            await db.commit()
            
    return db_message

async def clear_chat_history(db: AsyncSession, user_id: uuid.UUID) -> None:
    query = delete(ChatMessage).where(ChatMessage.user_id == user_id)
    await db.execute(query)
    await db.commit()

async def delete_chat_session(db: AsyncSession, user_id: uuid.UUID, session_id: uuid.UUID) -> None:
    # First delete messages in session
    msg_query = delete(ChatMessage).where(ChatMessage.session_id == session_id, ChatMessage.user_id == user_id)
    await db.execute(msg_query)
    # Then delete session
    sess_query = delete(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    await db.execute(sess_query)
    await db.commit()

from src.models.profile_model import Profile
from src.models.financial_model import FinancialPeriod, FinancialEntry
from src.models.report_model import Report
from src.models.goal_model import Goal
from src.models.investment_model import InvestmentProfile
from src.core.llm_service import generate_financial_advice

async def generate_ai_response(db: AsyncSession, user_id: uuid.UUID, user_message: str, session_id: uuid.UUID | None = None) -> str:
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
    goals_str = ", ".join([f"{g.title} ({g.current_amount}/{g.target_amount})" for g in goals]) if goals else "Yok"
    
    # Alerts
    from src.models.alert_model import Alert
    alerts_result = await db.execute(select(Alert).where(Alert.user_id == user_id).where(Alert.is_read == False))
    alerts = alerts_result.scalars().all()
    alerts_str = ", ".join([f"{a.title} ({a.level})" for a in alerts]) if alerts else "Yok"
    
    # Risk Level
    inv_result = await db.execute(select(InvestmentProfile).where(InvestmentProfile.user_id == user_id))
    inv_profile = inv_result.scalar_one_or_none()
    risk_level = inv_profile.risk_level if inv_profile and inv_profile.risk_level else "Bilinmiyor"
    
    dti_ratio = 0.0
    if latest_period and income > 0:
        loan_payments = sum(e.amount for e in (entries if latest_period else []))
        dti_ratio = round((loan_payments / income) * 100, 2)
        
    profile_summary = f"Yaş: {profile.age if profile else '-'}, Şehir: {profile.city if profile else '-'}, Çalışma Tipi: {profile.employment_type if profile else '-'}"

    user_data = {
        "has_budget": latest_period is not None,
        "profile_summary": profile_summary,
        "income": income,
        "expense": expense,
        "savings_rate": savings_rate,
        "dti_ratio": dti_ratio,
        "health_score": health_score,
        "goals": goals_str,
        "alerts": alerts_str,
    }
    
    # 2. Fetch Chat History (last 10 messages for context in THIS session)
    history_query = select(ChatMessage).where(ChatMessage.user_id == user_id)
    if session_id:
        history_query = history_query.where(ChatMessage.session_id == session_id)
    history_query = history_query.order_by(ChatMessage.created_at.desc()).limit(10)
    
    history_result = await db.execute(history_query)
    messages = list(history_result.scalars().all())
    messages.reverse() # chronological order
    
    chat_history = [{"role": msg.role, "content": msg.content} for msg in messages if msg.role in ["user", "assistant"]]
    
    # 3. Call LLM
    ai_response_text = await generate_financial_advice(user_data, user_message, chat_history)
    
    return ai_response_text
