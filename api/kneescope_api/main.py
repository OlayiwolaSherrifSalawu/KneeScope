"""KneeScope API. Run: ``scripts/dev-api.sh`` (fixture mode by default).

Routes follow docs/architecture.md. Every JSON response is a contract model from
``kneescope_contracts.models``; every error is an ``ApiError``.
"""

from __future__ import annotations

import logging
from functools import cache
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from kneescope_api import API_VERSION
from kneescope_api.errors import ApiException, install_error_handlers
from kneescope_api.service import fixture_explanation, fixture_labels, fixture_prediction
from kneescope_api.settings import Settings, load_settings
from kneescope_api.store import FixtureStore
from kneescope_contracts.findings import load_profile
from kneescope_contracts.models import (
    SCHEMA_VERSION,
    ApiError,
    ErrorCode,
    Explanation,
    FindingProfile,
    Health,
    MetricsSnapshot,
    ModelCard,
    PredictionRequest,
    PredictionResponse,
    StudyDetail,
    StudyLabels,
    StudyList,
)
from kneescope_ml.adapters.fixture import FixtureAdapter
from kneescope_ml.config import load_model_config, load_preprocessing_config
from kneescope_ml.render import render_slice_png

ERRORS: dict[int | str, dict[str, Any]] = {code: {"model": ApiError} for code in (404, 422, 500, 503)}
StudyId = Annotated[str, Path(pattern=r"^[A-Za-z0-9._-]{1,128}$")]


@cache
def get_settings() -> Settings:
    return load_settings()


@cache
def get_store() -> FixtureStore:
    return FixtureStore()


def require_fixture_mode(settings: Annotated[Settings, Depends(get_settings)]) -> Settings:
    """Model mode is not implemented yet (KS-API-02). Fail loudly rather than fake it."""
    if settings.mode != "fixture":
        raise ApiException(
            503,
            ErrorCode.MODEL_NOT_LOADED,
            "Model mode is not implemented yet. Start the API with KNEESCOPE_MODE=fixture.",
            retryable=False,
        )
    return settings


FixtureSettings = Annotated[Settings, Depends(require_fixture_mode)]
Store = Annotated[FixtureStore, Depends(get_store)]


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level.upper())
    load_profile(settings.finding_profile)  # fail fast on an unknown profile
    model_cfg, prep_cfg = load_model_config(), load_preprocessing_config()

    app = FastAPI(
        title="KneeScope API",
        version=API_VERSION,
        description="Knee MRI research review prototype. Not for diagnosis. "
        f"Contract schema {SCHEMA_VERSION}.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["X-Request-ID"],
    )
    install_error_handlers(app)

    @app.get("/healthz", response_model=Health, tags=["service"])
    def healthz() -> Health:
        return Health(
            status="ok",
            api_version=API_VERSION,
            mode=settings.mode,
            model_loaded=False,
            model_version=None,
            preprocessing_version=prep_cfg.version,
            finding_profile=settings.finding_profile,
        )

    @app.get("/readyz", response_model=Health, tags=["service"])
    def readyz() -> Health:
        """Ready to serve: fixture data loads (model mode adds checkpoint checks, KS-API-02)."""
        if settings.mode == "fixture":
            get_store().studies  # noqa: B018 - raises if fixtures are missing or invalid
        return healthz()

    @app.get("/findings", response_model=FindingProfile, tags=["findings"])
    def findings() -> FindingProfile:
        return load_profile(settings.finding_profile)

    @app.get("/studies", response_model=StudyList, responses=ERRORS, tags=["studies"])
    def studies(_: FixtureSettings, store: Store) -> StudyList:
        return StudyList(
            studies=store.summaries(),
            origin_notice="FIXTURE - synthetic development studies, not dataset studies.",
        )

    @app.get("/studies/{study_id}", response_model=StudyDetail, responses=ERRORS, tags=["studies"])
    def study(study_id: StudyId, _: FixtureSettings, store: Store) -> StudyDetail:
        found = store.studies.get(study_id)
        if found is None:
            raise ApiException(404, ErrorCode.STUDY_NOT_FOUND, f"Study {study_id} not found.")
        return found

    @app.get(
        "/studies/{study_id}/series/{series_id}/slices/{index}",
        response_class=Response,
        responses={200: {"content": {"image/png": {}}}, **ERRORS},
        tags=["studies"],
    )
    def slice_png(
        study_id: StudyId,
        series_id: StudyId,
        index: Annotated[int, Path(ge=0)],
        _: FixtureSettings,
        store: Store,
    ) -> Response:
        found = store.studies.get(study_id)
        if found is None:
            raise ApiException(404, ErrorCode.STUDY_NOT_FOUND, f"Study {study_id} not found.")
        series = next((s for s in found.series if s.series_id == series_id), None)
        if series is None:
            raise ApiException(404, ErrorCode.SERIES_NOT_FOUND, f"Series {series_id} not found.")
        if index >= series.num_slices:
            raise ApiException(
                404, ErrorCode.SLICE_OUT_OF_RANGE, f"slice_index must be 0..{series.num_slices - 1}."
            )
        volume = FixtureAdapter().load_series(study_id, series_id)
        png = render_slice_png(volume, index, prep_cfg, watermark="SYNTHETIC - NOT AN MRI")
        return Response(
            png,
            media_type="image/png",
            headers={"Cache-Control": "private, max-age=3600", "X-KneeScope-Origin": "fixture"},
        )

    @app.post("/predictions", response_model=PredictionResponse, responses=ERRORS, tags=["predictions"])
    def predict(body: PredictionRequest, _: FixtureSettings, store: Store) -> PredictionResponse:
        return fixture_prediction(
            store, body.study_id, body.findings, settings.finding_profile, model_cfg, prep_cfg
        )

    @app.get(
        "/studies/{study_id}/explanations/{finding_id}",
        response_model=Explanation,
        responses=ERRORS,
        tags=["predictions"],
    )
    def explanation(
        study_id: StudyId,
        finding_id: StudyId,
        prediction_id: Annotated[str, Query(min_length=1, max_length=200)],
        _: FixtureSettings,
        store: Store,
    ) -> Explanation:
        if finding_id not in {f.finding_id for f in load_profile(settings.finding_profile).findings}:
            raise ApiException(
                422, ErrorCode.FINDING_NOT_IN_PROFILE, f"{finding_id} is not in the active finding profile."
            )
        return fixture_explanation(store, study_id, finding_id, prediction_id, model_cfg)

    @app.get("/studies/{study_id}/labels", response_model=StudyLabels, responses=ERRORS, tags=["evaluation"])
    def labels(study_id: StudyId, _: FixtureSettings, store: Store) -> StudyLabels:
        return fixture_labels(store, study_id, settings.finding_profile)

    @app.get("/metrics", response_model=MetricsSnapshot, responses=ERRORS, tags=["evaluation"])
    def metrics(_: FixtureSettings, store: Store) -> MetricsSnapshot:
        return store.metrics

    @app.get("/model-card", response_model=ModelCard, responses=ERRORS, tags=["evaluation"])
    def model_card(_: FixtureSettings, store: Store) -> ModelCard:
        return store.model_card

    return app


app = create_app()
