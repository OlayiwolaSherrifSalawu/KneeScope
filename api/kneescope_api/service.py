"""Prediction, explanation and label assembly.

Label isolation: ``predict`` never touches ``FixtureStore.labels`` or
``kneescope_ml.labels``. ``tests/test_label_isolation.py`` checks this module's
prediction functions by inspection.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from uuid import uuid4

from kneescope_api.catalogue import StudyCatalogue
from kneescope_api.errors import ApiException
from kneescope_api.store import FixtureStore
from kneescope_contracts.findings import load_profile
from kneescope_contracts.models import (
    FIXTURE_NOTICE,
    DatasetLabel,
    ErrorCode,
    Explanation,
    FindingResult,
    FindingStatus,
    InputUsage,
    ModelInfo,
    Plane,
    PredictionResponse,
    PreprocessingInfo,
    Reason,
    ResultProvenance,
    ResultSource,
    ScoreKind,
    StudyLabels,
)
from kneescope_ml.config import ModelConfig, PreprocessingConfig
from kneescope_ml.inference import Predictor
from kneescope_ml.preprocess import PreprocessingError, preprocess_study


def fixture_model_info(model_cfg: ModelConfig, profile_id: str) -> ModelInfo:
    profile = load_profile(profile_id)
    return ModelInfo(
        model_id=model_cfg.fixture_model_id,
        model_version=model_cfg.fixture_model_version,
        checkpoint_sha256=None,
        finding_profile=profile_id,
        supported_findings=[
            f.finding_id for f in profile.findings if f.finding_id not in model_cfg.fixture_unsupported
        ],
        trained_on=None,
    )


def _check_findings(requested: list[str] | None, profile_id: str) -> list[tuple[str, str]]:
    profile = [(f.finding_id, f.display_name) for f in load_profile(profile_id).findings]
    if requested is None:
        return profile
    known = dict(profile)
    unknown = [f for f in requested if f not in known]
    if unknown:
        raise ApiException(
            422,
            ErrorCode.FINDING_NOT_IN_PROFILE,
            f"Findings not in the active profile: {', '.join(unknown)}.",
            detail={"profile": profile_id, "findings": unknown},
        )
    return [(f, known[f]) for f in requested]


def fixture_prediction(
    store: FixtureStore,
    study_id: str,
    requested: list[str] | None,
    profile_id: str,
    model_cfg: ModelConfig,
    prep_cfg: PreprocessingConfig,
) -> PredictionResponse:
    study = store.studies.get(study_id)
    if study is None:
        raise ApiException(404, ErrorCode.STUDY_NOT_FOUND, f"Study {study_id} not found.")
    findings = _check_findings(requested, profile_id)
    spec = store.predictions.get(study_id, {})
    if "study_error" in spec:
        err = spec["study_error"]
        raise ApiException(422, ErrorCode(err["code"]), err["message"], retryable=err["retryable"])

    model = fixture_model_info(model_cfg, profile_id)
    supported = set(model.supported_findings)
    results: list[FindingResult] = []
    for finding_id, name in findings:
        entry = spec.get("findings", {}).get(finding_id)
        if finding_id not in supported:
            results.append(
                FindingResult(
                    finding_id=finding_id,
                    display_name=name,
                    status=FindingStatus.unsupported,
                    reason=Reason(code="NOT_SUPPORTED", message="Not supported by this model."),
                )
            )
        elif entry is None:
            results.append(
                FindingResult(finding_id=finding_id, display_name=name, status=FindingStatus.not_evaluated)
            )
        elif entry["status"] == "scored":
            results.append(
                FindingResult(
                    finding_id=finding_id,
                    display_name=name,
                    status=FindingStatus.scored,
                    score=entry["score"],
                    score_kind=ScoreKind.uncalibrated_model_score,
                    explanation_available=entry.get("explanation_available", False),
                )
            )
        else:
            results.append(
                FindingResult(
                    finding_id=finding_id,
                    display_name=name,
                    status=FindingStatus(entry["status"]),
                    reason=Reason(**entry["reason"]),
                )
            )

    first_series = {}
    for s in study.series:
        if s.plane is not None and s.plane not in first_series:
            first_series[s.plane] = s
    inputs = [
        InputUsage(plane=p, series_id=s.series_id, slices_used=min(s.num_slices, prep_cfg.num_slices))
        for p, s in first_series.items()
    ]
    return PredictionResponse(
        prediction_id=f"fx-pred-{study_id}-{profile_id}",
        study_id=study_id,
        provenance=ResultProvenance(
            source=ResultSource.fixture, computed_at=None, served_at=datetime.now(UTC), notice=FIXTURE_NOTICE
        ),
        model=model,
        preprocessing=PreprocessingInfo(version=prep_cfg.version, config_sha256=prep_cfg.sha256),
        findings=results,
        inputs=inputs,
        missing_planes=study.missing_planes,
        warnings=[Reason(code="FIXTURE", message=FIXTURE_NOTICE)],
    )


def model_prediction(
    catalogue: StudyCatalogue,
    predictor: Predictor,
    study_id: str,
    requested: list[str] | None,
    profile_id: str,
    model_cfg: ModelConfig,
    prep_cfg: PreprocessingConfig,
) -> PredictionResponse:
    """The live model path (KS-API-02): shared preprocessing, real checkpoint.

    Label isolation holds by construction: only the catalogue, preprocessing and the
    predictor are consulted; the label store is never touched.
    """
    detail = catalogue.detail(study_id)
    findings = _check_findings(requested, profile_id)
    volumes = catalogue.load_volumes(study_id)
    try:
        pre = preprocess_study(study_id, volumes, prep_cfg)
    except PreprocessingError as exc:  # message is reviewer-safe by contract
        raise ApiException(422, ErrorCode.PREPROCESSING_FAILED, str(exc)) from None

    missing_plane = next(
        (p for p in model_cfg.required_planes if not (pre.planes.get(p) and pre.planes[p].present)),
        None,
    )
    started = time.perf_counter()
    output = None if missing_plane is not None else predictor.predict(pre)
    latency_ms = max((time.perf_counter() - started) * 1000, 0.001)
    supported = set(predictor.supported_findings)

    results: list[FindingResult] = []
    for finding_id, name in findings:
        if finding_id not in supported:
            results.append(
                FindingResult(
                    finding_id=finding_id,
                    display_name=name,
                    status=FindingStatus.unsupported,
                    reason=Reason(code="NOT_SUPPORTED", message="Not supported by this model."),
                )
            )
        elif missing_plane is not None:
            results.append(
                FindingResult(
                    finding_id=finding_id,
                    display_name=name,
                    status=FindingStatus.unavailable,
                    reason=Reason(
                        code="INPUT_INVALID",
                        message=f"The required {missing_plane} series is missing; "
                        f"{finding_id} cannot be scored.",
                    ),
                )
            )
        elif output is None or finding_id not in output.scores:
            results.append(
                FindingResult(
                    finding_id=finding_id,
                    display_name=name,
                    status=FindingStatus.failed,
                    reason=Reason(code="INFERENCE_FAILED", message="The model returned no score."),
                )
            )
        else:
            results.append(
                FindingResult(
                    finding_id=finding_id,
                    display_name=name,
                    status=FindingStatus.scored,
                    score=min(max(output.scores[finding_id], 0.0), 1.0),
                    score_kind=ScoreKind.uncalibrated_model_score,
                )
            )

    now = datetime.now(UTC)
    return PredictionResponse(
        prediction_id=f"pred-{study_id}-{uuid4().hex[:10]}",
        study_id=study_id,
        provenance=ResultProvenance(
            source=ResultSource.live, computed_at=now, served_at=now, latency_ms=latency_ms
        ),
        model=ModelInfo(
            model_id=predictor.model_id,
            model_version=predictor.model_version,
            checkpoint_sha256=predictor.checkpoint_sha256,
            finding_profile=profile_id,
            supported_findings=list(predictor.supported_findings),
            trained_on=model_cfg.trained_on or None,
        ),
        preprocessing=PreprocessingInfo(version=prep_cfg.version, config_sha256=prep_cfg.sha256),
        findings=results,
        inputs=[
            InputUsage(plane=Plane(pt.plane), series_id=pt.series_id, slices_used=int(pt.mask.sum()))
            for pt in pre.planes.values()
            if pt.present and pt.series_id is not None
        ],
        missing_planes=detail.missing_planes,
        warnings=[Reason(code="PREPROCESSING", message=w) for w in pre.warnings],
    )


def fixture_explanation(
    store: FixtureStore,
    study_id: str,
    finding_id: str,
    prediction_id: str,
    model_cfg: ModelConfig,
) -> Explanation:
    study = store.studies.get(study_id)
    if study is None:
        raise ApiException(404, ErrorCode.STUDY_NOT_FOUND, f"Study {study_id} not found.")
    spec = store.explanations.get(study_id, {}).get(finding_id)
    common = dict(
        study_id=study_id,
        finding_id=finding_id,
        prediction_id=prediction_id,
        model_version=model_cfg.fixture_model_version,
        source=ResultSource.fixture,
    )
    if spec is None:
        return Explanation(
            status="unavailable",
            **common,  # type: ignore[arg-type]
            reason=Reason(
                code=ErrorCode.EXPLANATION_UNAVAILABLE.value,
                message="No explanation was produced for this finding.",
            ),
        )
    series = next(s for s in study.series if s.series_id == spec["series_id"])
    return Explanation(
        status="available",
        kind=spec["kind"],
        series_id=series.series_id,  # type: ignore[arg-type]
        plane=series.plane,
        rendered_width=series.rendered_width,
        rendered_height=series.rendered_height,
        slices=spec["slices"],
        **common,
    )


def fixture_labels(store: FixtureStore, study_id: str, profile_id: str) -> StudyLabels:
    if study_id not in store.studies:
        raise ApiException(404, ErrorCode.STUDY_NOT_FOUND, f"Study {study_id} not found.")
    raw = store.labels.get(study_id)
    if raw is None:
        raise ApiException(404, ErrorCode.LABELS_UNAVAILABLE, "No dataset labels for this study.")
    wanted = [f.finding_id for f in load_profile(profile_id).findings]
    return StudyLabels(
        study_id=study_id,
        dataset_id=None,
        origin="fixture",  # type: ignore[arg-type]
        labels=[DatasetLabel(finding_id=f, **raw[f]) for f in wanted if f in raw],
    )
