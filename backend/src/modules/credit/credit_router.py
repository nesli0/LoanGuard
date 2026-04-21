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
from src.modules.credit.credit_loader import ml_models
from src.modules.credit.credit_schemas import CreditAnalyzeRequest, CreditAnalyzeResponse

router = APIRouter(prefix="/credit", tags=["Credit"])


@router.on_event("startup")
async def load_models() -> None:
    """Uygulama başlarken ML modellerini yükle."""
    ml_models.load()


@router.post("/analyze")
async def analyze_credit(
    body: CreditAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[CreditAnalyzeResponse]:
    """
    Kredi analizi — XGBoost + SHAP + Anomali + Faiz Tahmini + Counterfactual.

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

    monthly_income = 0.0
    dti_ratio = 0.0

    if latest_period:
        entries_result = await db.execute(
            select(FinancialEntry).where(FinancialEntry.period_id == latest_period.id)
        )
        entries = entries_result.scalars().all()

        total_income = sum(e.amount for e in entries if e.type == "income")
        loan_payments = sum(e.amount for e in entries if e.is_loan_payment)

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

    return ApiResponse(
        message="Kredi analizi tamamlandı.",
        data=result,
    )
