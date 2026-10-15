"""KneeScope API. Run: ``scripts/dev-api.sh`` (fixture mode by default).

Routes follow docs/architecture.md. Every JSON response is a contract model from
``kneescope_contracts.models``; every error is an ``ApiError``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from kneescope_api import API_VERSION
from kneescope_api.cache import PredictionCache
from kneescope_api.catalogue import DatasetCatalogue, FixtureCatalogue, StudyCatalogue
from kneescope_api.errors import ApiException, install_error_handlers
from kneescope_api.service import fixture_explanation, fixture_labels, fixture_prediction, model_prediction
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
from kneescope_ml.config import ModelConfig, PreprocessingConfig, load_model_config, load_preprocessing_config
from kneescope_ml.inference import ModelNotAvailableError, Predictor, load_predictor

ERRORS: dict[int | str, dict[str, Any]] = {code: {"model": ApiError} for code in (404, 422, 500, 503)}
StudyId = Annotated[str, Path(pattern=r"^[A-Za-z0-9._-]{1,128}$")]


@dataclass(frozen=True)
class AppState:
    """Everything a request needs; one instance per app (no process-wide caches)."""

    settings: Settings
    store: FixtureStore
    catalogue: StudyCatalogue
    model_cfg: ModelConfig
    prep_cfg: PreprocessingConfig
    predictor: Predictor | None = None
    cache: PredictionCache | None = None


def get_state(request: Request) -> AppState:
    state: AppState = request.app.state.ks
    return state


def require_fixture_mode(request: Request) -> AppState:
    """Labels and evaluation are fixture-only until KS-API-05. Fail loudly."""
    state = get_state(request)
    if state.settings.mode != "fixture":
        raise ApiException(
            503,
            ErrorCode.MODEL_NOT_LOADED,
            "Model-mode inference, labels and metrics are not implemented yet (KS-API-02, KS-API-05).",
            retryable=False,
        )
    return state


State = Annotated[AppState, Depends(get_state)]
FixtureState = Annotated[AppState, Depends(require_fixture_mode)]


def create_app(
    settings: Settings | None = None,
    *,
    model_cfg: ModelConfig | None = None,
    prep_cfg: PreprocessingConfig | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    logging.basicConfig(level=settings.log_level.upper())
    load_profile(settings.finding_profile)  # fail fast on an unknown profile
    model_cfg, prep_cfg = model_cfg or load_model_config(), prep_cfg or load_preprocessing_config()
    store = FixtureStore()
    catalogue: StudyCatalogue
    predictor: Predictor | None = None
    cache: PredictionCache | None = None
    if settings.mode == "model":
        assert settings.manifest is not None and settings.data_root is not None
        catalogue = DatasetCatalogue(settings.manifest, settings.data_root, prep_cfg)
        cache = PredictionCache(model_cfg.cache_dir)
        try:
            predictor = load_predictor(model_cfg)
        except ModelNotAvailableError as exc:
            logging.getLogger(__name__).warning("model mode has no usable checkpoint: %s", exc)
    else:
        catalogue = FixtureCatalogue(store, prep_cfg)

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
    app.state.ks = AppState(settings, store, catalogue, model_cfg, prep_cfg, predictor, cache)

    @app.get("/healthz", response_model=Health, tags=["service"])
    def healthz() -> Health:
        return Health(
            status="ok",
            api_version=API_VERSION,
            mode=settings.mode,
            model_loaded=predictor is not None,
            model_version=predictor.model_version if predictor is not None else None,
            preprocessing_version=prep_cfg.version,
            finding_profile=settings.finding_profile,
        )

    @app.get("/readyz", response_model=Health, tags=["service"])
    def readyz() -> Health:
        """Ready to serve: the study catalogue loads (KS-API-02 adds checkpoint checks)."""
        catalogue.summaries()
        return healthz()

    @app.get("/findings", response_model=FindingProfile, tags=["findings"])
    def findings() -> FindingProfile:
        return load_profile(settings.finding_profile)

    @app.get("/studies", response_model=StudyList, responses=ERRORS, tags=["studies"])
    def studies(state: State) -> StudyList:
        return StudyList(studies=state.catalogue.summaries(), origin_notice=state.catalogue.notice)

    @app.get("/studies/{study_id}", response_model=StudyDetail, responses=ERRORS, tags=["studies"])
    def study(study_id: StudyId, state: State) -> StudyDetail:
        return state.catalogue.detail(study_id)

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
        state: State,
    ) -> Response:
        png = state.catalogue.slice_png(study_id, series_id, index)
        return Response(
            png,
            media_type="image/png",
            headers={
                "Cache-Control": "private, max-age=3600",
                "X-KneeScope-Origin": state.catalogue.origin,
            },
        )

    @app.post("/predictions", response_model=PredictionResponse, responses=ERRORS, tags=["predictions"])
    def predict(body: PredictionRequest, state: State) -> PredictionResponse:
        if settings.mode == "fixture":
            return fixture_prediction(
                state.store, body.study_id, body.findings, settings.finding_profile, model_cfg, prep_cfg
            )
        if state.predictor is None or state.cache is None:
            raise ApiException(
                503,
                ErrorCode.MODEL_NOT_LOADED,
                "Model mode has no usable checkpoint; set checkpoint_path and checkpoint_sha256 "
                "in config/model.toml.",
                retryable=False,
            )
        if body.allow_cached:
            key = PredictionCache.key(
                study_id=body.study_id,
                model_version=state.predictor.model_version,
                checkpoint_sha256=state.predictor.checkpoint_sha256,
                preprocessing_version=prep_cfg.version,
                finding_profile=settings.finding_profile,
            )
            hit = state.cache.get(key, study_id=body.study_id, findings=body.findings)
            if hit is not None:
                return hit
        return model_prediction(
            state.catalogue,
            state.predictor,
            body.study_id,
            body.findings,
            settings.finding_profile,
            model_cfg,
            prep_cfg,
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
        state: FixtureState,
    ) -> Explanation:
        if finding_id not in {f.finding_id for f in load_profile(settings.finding_profile).findings}:
            raise ApiException(
                422, ErrorCode.FINDING_NOT_IN_PROFILE, f"{finding_id} is not in the active finding profile."
            )
        return fixture_explanation(state.store, study_id, finding_id, prediction_id, model_cfg)

    @app.get("/studies/{study_id}/labels", response_model=StudyLabels, responses=ERRORS, tags=["evaluation"])
    def labels(study_id: StudyId, state: FixtureState) -> StudyLabels:
        return fixture_labels(state.store, study_id, settings.finding_profile)

    @app.get("/metrics", response_model=MetricsSnapshot, responses=ERRORS, tags=["evaluation"])
    def metrics(state: FixtureState) -> MetricsSnapshot:
        return state.store.metrics

    @app.get("/model-card", response_model=ModelCard, responses=ERRORS, tags=["evaluation"])
    def model_card(state: FixtureState) -> ModelCard:
        return state.store.model_card

    return app


app = create_app()
