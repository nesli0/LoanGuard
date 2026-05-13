from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.core.dependencies import get_current_user
from src.core.exceptions import AppException
from src.core.schemas import ApiResponse
from src.models.credit_model import CreditAnalysis
from src.models.profile_model import Profile
from src.models.financial_model import FinancialEntry, FinancialPeriod
from src.models.user_model import User
from src.modules.credit import credit_service
from src.modules.credit.credit_schemas import (
    CreditAnalyzeRequest, 
    CreditAnalyzeResponse,
    CreditExplainRequest,
    CreditExplainResponse
)
from src.core.llm_service import generate_credit_explanation

router = APIRouter(prefix="/credit", tags=["Credit"])

# NOT: Model yüklemesi main.py lifespan'inde yapılıyor.
# @router.on_event("startup") kaldırıldı.


@router.post("/analyze")
async def analyze_credit(
    body: CreditAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CreditAnalyzeResponse]:
    """
    Kredi analizi — XGBoost + SHAP + Anomali + Faiz Tahmini + DiCE Counterfactual.

    Kullanıcının profil ve bütçe verisi otomatik olarak çekilir.
    Sadece kredi talep bilgilerini göndermeniz yeterlidir.
    """
    # ── 1. Profil çek ──────────────────────────────────────────────
    profile_result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise AppException(422, "Analiz için önce profilinizi tamamlayın.", "CREDIT_PROFILE_INCOMPLETE")

    profile_data = {
        "age":             profile.age,
        "education":       profile.education,
        "employment_type": profile.employment_type,
        "marital_status":  profile.marital_status,
        "dependents":      profile.dependents,
    }

    # ── 2. Son dönem bütçesini çek (gelir + DTI) ───────────────────
    latest_period_result = await db.execute(
        select(FinancialPeriod)
        .where(FinancialPeriod.user_id == current_user.id)
        .order_by(FinancialPeriod.year.desc(), FinancialPeriod.month.desc())
        .limit(1)
    )
    latest_period = latest_period_result.scalar_one_or_none()

    if not latest_period:
        raise AppException(
            400,
            "Kredi analizi yapabilmek için önce bütçe bilgilerinizi girmeniz gerekiyor.",
            "BUDGET_REQUIRED",
            data={"redirect": "/budget"}
        )

    entries_result = await db.execute(
        select(FinancialEntry).where(FinancialEntry.period_id == latest_period.id)
    )
    entries = entries_result.scalars().all()

    total_income  = sum(e.amount for e in entries if e.type == "income")
    loan_payments = sum(e.amount for e in entries if e.is_loan_payment)

    if total_income == 0.0:
        raise AppException(
            400,
            "Kredi analizi yapabilmek için önce bütçe bilgilerinizi girmeniz gerekiyor.",
            "BUDGET_REQUIRED",
            data={"redirect": "/budget"}
        )

    monthly_income = total_income
    dti_ratio = round(loan_payments / total_income, 4) if total_income > 0 else 0.0

    # ── 3. ML Pipeline ─────────────────────────────────────────────
    result = await credit_service.analyze_credit(
        req=body,
        profile=profile_data,
        dti_ratio=dti_ratio,
        monthly_income=monthly_income,
    )

    # ── 4. Sonucu kaydet ───────────────────────────────────────────
    analysis = CreditAnalysis(
        user_id=current_user.id,
        approval_probability=result.approval_probability,
        shap_factors={"factors": [f.model_dump() for f in result.shap_factors]},
        counterfactuals={"items": [c.model_dump() for c in result.counterfactuals]},
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    result.analysis_id = str(analysis.id)

    return ApiResponse(
        message="Kredi analizi tamamlandı.",
        data=result,
    )


@router.post("/explain")
async def explain_credit(
    body: CreditExplainRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CreditExplainResponse]:
    """
    Kullanıcının kredi analiz sonucunu yapay zeka ile Türkçe açıklar.
    """
    # Fetch analysis
    import uuid
    try:
        analysis_uuid = uuid.UUID(body.analysis_id)
    except ValueError:
        raise AppException(400, "Geçersiz analiz ID formatı.", "INVALID_ANALYSIS_ID")

    result = await db.execute(
        select(CreditAnalysis)
        .where(CreditAnalysis.id == analysis_uuid)
        .where(CreditAnalysis.user_id == current_user.id)
    )
    analysis = result.scalar_one_or_none()
    
    if not analysis:
        raise AppException(404, "Kredi analizi bulunamadı veya size ait değil.", "ANALYSIS_NOT_FOUND")
        
    analysis_data = {
        "approval_probability": analysis.approval_probability,
        "shap_factors": analysis.shap_factors,
        "counterfactuals": analysis.counterfactuals
    }
    
    explanation = await generate_credit_explanation(analysis_data)
    
    return ApiResponse(
        message="Kredi analizi açıklaması oluşturuldu.",
        data=CreditExplainResponse(explanation=explanation)
    )
