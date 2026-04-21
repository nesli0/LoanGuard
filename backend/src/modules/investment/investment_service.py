import uuid
from datetime import UTC, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.investment_model import InvestmentProfile
from src.modules.investment.investment_schemas import InvestmentProfileCreate, InvestmentProfileUpdate

def calculate_risk(score: int) -> str:
    if score < 15:
        return "conservative"
    elif score < 30:
        return "moderate"
    else:
        return "aggressive"

def get_recommendations(risk_level: str) -> list[str]:
    if risk_level == "conservative":
        return ["Mevduat", "Devlet Tahvili", "Para Piyasası Fonları"]
    elif risk_level == "moderate":
        return ["Hisse Senedi Fonları", "Altın", "Özel Sektör Tahvilleri"]
    else:
        return ["Doğrudan Hisse Senedi", "Kripto Varlıklar", "Yabancı Hisse Fonları"]

async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> InvestmentProfile | None:
    query = select(InvestmentProfile).where(InvestmentProfile.user_id == user_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def create_profile(db: AsyncSession, user_id: uuid.UUID, data: InvestmentProfileCreate) -> InvestmentProfile:
    # Calculate simple risk score: sum of all answer values
    score = sum(ans.answer_value for ans in data.answers)
    risk_level = calculate_risk(score)
    recommendations = get_recommendations(risk_level)
    
    answers_dict = [ans.model_dump() for ans in data.answers]

    profile = InvestmentProfile(
        user_id=user_id,
        risk_score=score,
        risk_level=risk_level,
        questionnaire_answers=answers_dict,
        recommended_instruments=recommendations
    )
    
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile

async def update_profile(db: AsyncSession, profile: InvestmentProfile, data: InvestmentProfileUpdate) -> InvestmentProfile:
    score = sum(ans.answer_value for ans in data.answers)
    risk_level = calculate_risk(score)
    recommendations = get_recommendations(risk_level)
    
    answers_dict = [ans.model_dump() for ans in data.answers]

    profile.risk_score = score
    profile.risk_level = risk_level
    profile.questionnaire_answers = answers_dict
    profile.recommended_instruments = recommendations
    profile.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(profile)
    return profile
