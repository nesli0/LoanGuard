from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


# ── Uygulama genelinde tek hata formatı ──────────────────────────────
#
# Her cevap — başarılı ya da hatalı — şu formatta döner:
# {
#   "success": true | false,
#   "message": "...",
#   "error_code": "...",   (sadece hatalarda)
#   "data": ...            (sadece başarılarda)
# }
# ────────────────────────────────────────────────────────────────────

def _error_response(status: int, message: str, error_code: str = "") -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "success": False,
            "message": message,
            "error_code": error_code,
            "data": None,
        },
    )


class AppException(Exception):
    """Uygulama tarafından fırlatılan, kontrollü hata."""

    def __init__(self, status: int, message: str, error_code: str = ""):
        self.status = status
        self.message = message
        self.error_code = error_code
        super().__init__(message)


# ── Handler'lar ──────────────────────────────────────────────────────

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """AppException → düzgün hata yanıtı."""
    return _error_response(exc.status, exc.message, exc.error_code)


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """FastAPI/Starlette HTTPException → aynı formata çevir."""
    return _error_response(exc.status_code, str(exc.detail), "HTTP_ERROR")


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Pydantic validation hatası (422) → okunabilir mesaj formatı."""
    errors = exc.errors()
    # İlk hatanın field + message'ını öne çıkar
    if errors:
        field = " → ".join(str(loc) for loc in errors[0].get("loc", []))
        msg = errors[0].get("msg", "Geçersiz veri")
        message = f"{field}: {msg}" if field else msg
    else:
        message = "Geçersiz istek verisi"

    return _error_response(422, message, "VALIDATION_ERROR")


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Yakalanmayan tüm hatalar → 500."""
    return _error_response(500, "Beklenmeyen bir hata oluştu.", "INTERNAL_SERVER_ERROR")
