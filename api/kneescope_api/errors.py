"""Structured API errors. Every non-2xx JSON response is an ``ApiError``."""

from __future__ import annotations

import logging
import re
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from kneescope_contracts.models import ApiError, ApiErrorBody, ErrorCode

log = logging.getLogger("kneescope.api")


class ApiException(Exception):
    def __init__(
        self,
        status: int,
        code: ErrorCode,
        message: str,
        *,
        retryable: bool = False,
        detail: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message)
        self.status, self.code, self.message = status, code, message
        self.retryable, self.detail = retryable, detail


def request_id(request: Request) -> str:
    rid = getattr(request.state, "request_id", None)
    return rid if isinstance(rid, str) else f"req-{uuid.uuid4().hex[:12]}"


def _body(
    request: Request, code: str, message: str, retryable: bool, detail: dict[str, object] | None = None
) -> dict[str, object]:
    return ApiError(
        error=ApiErrorBody(
            code=code, message=message, request_id=request_id(request), retryable=retryable, detail=detail
        )
    ).model_dump(mode="json")


def install_error_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def _request_id(request: Request, call_next):  # type: ignore[no-untyped-def]
        # Honour a well-formed client ID (carried over from the original knee_api scaffold).
        incoming = request.headers.get("x-request-id", "")
        valid = re.fullmatch(r"[A-Za-z0-9._-]{1,64}", incoming)
        request.state.request_id = incoming if valid else f"req-{uuid.uuid4().hex[:12]}"
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(ApiException)
    async def _api(request: Request, exc: ApiException) -> JSONResponse:
        return JSONResponse(
            _body(request, exc.code.value, exc.message, exc.retryable, exc.detail),
            status_code=exc.status,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Field locations only; never echo request bodies (they may reference studies).
        fields = [".".join(str(p) for p in e["loc"]) for e in exc.errors()]
        return JSONResponse(
            _body(
                request,
                ErrorCode.VALIDATION_ERROR.value,
                "Request validation failed.",
                False,
                {"fields": fields},
            ),
            status_code=422,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = ErrorCode.STUDY_NOT_FOUND if exc.status_code == 404 else ErrorCode.INTERNAL_ERROR
        return JSONResponse(_body(request, code.value, str(exc.detail), False), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error request_id=%s", request_id(request))
        return JSONResponse(
            _body(request, ErrorCode.INTERNAL_ERROR.value, "Internal error.", True),
            status_code=500,
        )
