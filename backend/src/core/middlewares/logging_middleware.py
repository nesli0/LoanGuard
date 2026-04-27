import time
import uuid

from fastapi import Request, Response
from loguru import logger


async def logging_middleware(request: Request, call_next) -> Response:
    request_id = str(uuid.uuid4())[:8]
    start_time = time.perf_counter()

    logger.info(
        f"[{request_id}] → {request.method} {request.url.path}"
    )

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        f"[{request_id}] ← {response.status_code} ({duration_ms:.1f}ms)"
    )

    response.headers["X-Request-ID"] = request_id
    return response
