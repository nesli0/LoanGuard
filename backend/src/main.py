from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.config import settings
from src.core.exceptions import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from src.core.middlewares.logging_middleware import logging_middleware

# ── Routers ──────────────────────────────────────────────────────────
from src.modules.auth.auth_router import router as auth_router
from src.modules.credit.credit_router import router as credit_router
from src.modules.profile.profile_router import router as profile_router
from src.modules.budget.budget_router import router as budget_router
from src.modules.goals.goals_router import router as goals_router
from src.modules.alerts.alerts_router import router as alerts_router
from src.modules.chat.chat_router import router as chat_router
from src.modules.simulator.simulator_router import router as simulator_router
from src.modules.investment.investment_router import router as investment_router
from src.modules.report.report_router import router as report_router

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from src.core.middlewares.rate_limiter import limiter

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="LoanGuard API",
    description="Kişisel finansal sağlık ve kredi analiz platformu.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Logging Middleware ────────────────────────────────────────────────
app.add_middleware(BaseHTTPMiddleware, dispatch=logging_middleware)

# ── Exception Handlers (tek format, tüm hata türleri) ────────────────
app.add_exception_handler(AppException, app_exception_handler)             # type: ignore
app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore
app.add_exception_handler(Exception, unhandled_exception_handler)

# ── Rate Limiter ─────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Routers ──────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(credit_router, prefix="/api/v1")
app.include_router(profile_router, prefix="/api/v1")
app.include_router(budget_router, prefix="/api/v1")
app.include_router(goals_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(simulator_router, prefix="/api/v1")
app.include_router(investment_router, prefix="/api/v1")
app.include_router(report_router, prefix="/api/v1")


# ── Health Check ─────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {"success": True, "message": "OK", "data": {"version": "1.0.0"}}
