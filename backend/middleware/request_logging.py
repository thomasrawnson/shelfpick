import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import (
    BaseHTTPMiddleware,
)


logger = logging.getLogger(
    "boardgamepicker.request"
)


def safe_request_path(path: str) -> str:
    prefix = "/game-night/voting/"
    if not path.startswith(prefix):
        return path
    remainder = path[len(prefix):]
    if remainder.startswith("sessions/"):
        return path
    parts = remainder.split("/", 1)
    suffix = f"/{parts[1]}" if len(parts) > 1 else ""
    return f"{prefix}[join-token]{suffix}"


class RequestLoggingMiddleware(
    BaseHTTPMiddleware
):
    async def dispatch(
        self,
        request: Request,
        call_next,
    ):
        request_id = (
            request.headers.get(
                "X-Request-ID"
            )
            or str(uuid.uuid4())
        )

        request.state.request_id = (
            request_id
        )

        started_at = (
            time.perf_counter()
        )

        try:
            response = await call_next(
                request
            )

        except Exception:
            duration_ms = (
                time.perf_counter()
                - started_at
            ) * 1000

            logger.exception(
                (
                    "request_failed "
                    "request_id=%s "
                    "method=%s "
                    "path=%s "
                    "duration_ms=%.2f"
                ),
                request_id,
                request.method,
                safe_request_path(request.url.path),
                duration_ms,
            )

            raise

        duration_ms = (
            time.perf_counter()
            - started_at
        ) * 1000

        response.headers[
            "X-Request-ID"
        ] = request_id

        logger.info(
            (
                "request_completed "
                "request_id=%s "
                "method=%s "
                "path=%s "
                "status=%s "
                "duration_ms=%.2f"
            ),
            request_id,
            request.method,
            safe_request_path(request.url.path),
            response.status_code,
            duration_ms,
        )

        return response
