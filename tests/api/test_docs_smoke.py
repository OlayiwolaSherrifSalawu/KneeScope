"""Smoke test: docs/api.md describes the API that fixture mode actually serves.

The doc is the contract this file checks. It parses ``docs/api.md`` and then verifies:

- the documented endpoints are exactly the routes in the running OpenAPI document;
- every documented endpoint answers a valid request with the documented response;
- every reproducible documented error case returns the documented status and ErrorCode,
  and the doc's §6 status column agrees with what the API returned;
- fixture-only endpoints return the documented ``503 MODEL_NOT_LOADED`` outside
  fixture mode (full model-mode integration lives in tests/api/test_catalogue.py);
- every ErrorCode and contract enum value is documented.

Adding a route to the API or a section to the doc makes these tests fail until the other
side is updated — that is the point.
"""

from __future__ import annotations

import dataclasses
import json
import re
from pathlib import Path
from typing import get_args

import pytest
from fastapi.testclient import TestClient

from kneescope_api.main import create_app
from kneescope_contracts.models import (
    AnalysisStatus,
    DataOrigin,
    ErrorCode,
    FindingStatus,
    LabelProvenance,
    LabelState,
    MetricValue,
    Plane,
    ResultSource,
    ScoreKind,
    SliceOrder,
)

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs" / "api.md"
DOC_TEXT = DOC.read_text(encoding="utf-8")

client = TestClient(create_app())

PREDICTION_ID = "fx-pred-fx-study-001-interaction_prototype"
EXPLANATION_URL = f"/studies/fx-study-001/explanations/acl?prediction_id={PREDICTION_ID}"


# --------------------------------------------------------------------------
# Doc parsing
# --------------------------------------------------------------------------

DOC_ENDPOINT_RE = re.compile(r"^### \d+\.\d+ `(GET|POST) (/[^`]+)`", re.M)
ERROR_ROW_RE = re.compile(r"^\|\s*`([A-Z_]+)`\s*\|\s*([^|]+?)\s*\|")


def _section(title: str, next_title: str) -> str:
    return DOC_TEXT.split(title, 1)[1].split(next_title, 1)[0]


def documented_endpoints() -> set[tuple[str, str]]:
    """(METHOD, path-template) pairs from the §5 endpoint headings."""
    return {(m, p.split("?")[0]) for m, p in DOC_ENDPOINT_RE.findall(DOC_TEXT)}


def openapi_endpoints() -> set[tuple[str, str]]:
    spec = client.get("/openapi.json").json()
    return {(method.upper(), path) for path, ops in spec["paths"].items() for method in ops}


def doc_error_rows() -> dict[str, str]:
    """code → status cell from the §6 error-code table."""
    rows: dict[str, str] = {}
    for line in _section("## 6. Error handling in the UI", "## 7.").splitlines():
        match = ERROR_ROW_RE.match(line)
        if match:
            rows[match.group(1)] = match.group(2)
    return rows


# --------------------------------------------------------------------------
# Coverage: every documented endpoint exists, and vice versa
# --------------------------------------------------------------------------

# One valid request per documented endpoint (concrete ids from the fixtures):
# (method, url, json body or None, documented path template).
VALID_REQUESTS = [
    ("GET", "/healthz", None, "/healthz"),
    ("GET", "/readyz", None, "/readyz"),
    ("GET", "/findings", None, "/findings"),
    ("GET", "/studies", None, "/studies"),
    ("GET", "/studies/fx-study-001", None, "/studies/{study_id}"),
    (
        "GET",
        "/studies/fx-study-001/series/fx-ser-01/slices/12",
        None,
        "/studies/{study_id}/series/{series_id}/slices/{index}",
    ),
    (
        "POST",
        "/predictions",
        {"study_id": "fx-study-001", "allow_cached": True},
        "/predictions",
    ),
    ("GET", EXPLANATION_URL, None, "/studies/{study_id}/explanations/{finding_id}"),
    ("GET", "/studies/fx-study-001/labels", None, "/studies/{study_id}/labels"),
    ("GET", "/metrics", None, "/metrics"),
    ("GET", "/model-card", None, "/model-card"),
]


def test_doc_lists_exactly_the_running_routes():
    documented, running = documented_endpoints(), openapi_endpoints()
    assert documented == running, (
        f"undocumented routes: {sorted(running - documented)}; "
        f"documented but missing: {sorted(documented - running)}"
    )


def test_smoke_requests_cover_every_documented_endpoint():
    covered = {(method, template) for method, _, _, template in VALID_REQUESTS}
    assert covered == documented_endpoints()


@pytest.mark.parametrize("method,url,body,_template", VALID_REQUESTS)
def test_documented_endpoint_answers_200(method: str, url: str, body: dict | None, _template: str):
    resp = client.request(method, url, json=body) if body is not None else client.request(method, url)
    assert resp.status_code == 200, resp.text


# --------------------------------------------------------------------------
# Documented error cases: observed status and code must match the doc's §6 table
# --------------------------------------------------------------------------

ERROR_CASES = [
    pytest.param("GET", "/studies/does-not-exist", None, 404, "STUDY_NOT_FOUND", id="study-404"),
    pytest.param("GET", "/studies/bad$id", None, 422, "VALIDATION_ERROR", id="study-id-pattern-422"),
    pytest.param(
        "GET",
        "/studies/fx-study-001/series/fx-ser-99/slices/0",
        None,
        404,
        "SERIES_NOT_FOUND",
        id="series-404",
    ),
    pytest.param(
        "GET",
        "/studies/fx-study-001/series/fx-ser-01/slices/999",
        None,
        404,
        "SLICE_OUT_OF_RANGE",
        id="slice-404",
    ),
    pytest.param(
        "POST", "/predictions", {"study_id": "does-not-exist"}, 404, "STUDY_NOT_FOUND", id="predict-404"
    ),
    pytest.param(
        "POST",
        "/predictions",
        {"study_id": "fx-study-001", "findings": ["acl_tear"]},
        422,
        "FINDING_NOT_IN_PROFILE",
        id="predict-422-profile",
    ),
    pytest.param(
        "POST",
        "/predictions",
        {"study_id": "fx-study-003"},
        422,
        "PREPROCESSING_FAILED",
        id="predict-422-preprocessing",
    ),
    pytest.param(
        "POST",
        "/predictions",
        {"study_id": "fx-study-001", "unexpected": True},
        422,
        "VALIDATION_ERROR",
        id="predict-extra-field",
    ),
    pytest.param(
        "GET",
        "/studies/fx-study-001/explanations/acl",
        None,
        422,
        "VALIDATION_ERROR",
        id="explanation-missing-prediction-id",
    ),
    pytest.param(
        "GET",
        f"/studies/fx-study-001/explanations/not_a_finding?prediction_id={PREDICTION_ID}",
        None,
        422,
        "FINDING_NOT_IN_PROFILE",
        id="explanation-422-profile",
    ),
    pytest.param(
        "GET",
        f"/studies/does-not-exist/explanations/acl?prediction_id={PREDICTION_ID}",
        None,
        404,
        "STUDY_NOT_FOUND",
        id="explanation-404",
    ),
    pytest.param("GET", "/studies/does-not-exist/labels", None, 404, "STUDY_NOT_FOUND", id="labels-404"),
    # LABELS_UNAVAILABLE (404) is documented but every fixture study has labels,
    # so it is not reproducible here; its enum value and doc row are checked below.
]


@pytest.mark.parametrize("method,url,body,expected_status,expected_code", ERROR_CASES)
def test_documented_error_case_returns_documented_status_and_code(
    method: str, url: str, body: dict | None, expected_status: int, expected_code: str
):
    resp = client.request(method, url, json=body) if body is not None else client.request(method, url)
    assert resp.status_code == expected_status, resp.text
    error = resp.json()["error"]
    assert error["code"] == expected_code
    assert error["request_id"] == resp.headers["x-request-id"]
    # The §6 status column must agree with the observed status.
    doc_row = doc_error_rows()[expected_code]
    assert str(expected_status) in doc_row, f"docs/api.md lists {expected_code} as {doc_row!r}"


# --------------------------------------------------------------------------
# Documented behaviour of the fixture data (docs/api.md §5.7, §9)
# --------------------------------------------------------------------------


def test_prediction_states_match_the_documented_table():
    body = client.post("/predictions", json={"study_id": "fx-study-001"}).json()
    by_id = {f["finding_id"]: f for f in body["findings"]}
    assert by_id["acl"]["status"] == "scored" and 0.0 <= by_id["acl"]["score"] <= 1.0
    assert by_id["mcl"]["status"] == "scored"
    assert by_id["medial_meniscus"]["status"] == "failed"
    assert by_id["medial_meniscus"]["reason"]["code"] == "INFERENCE_FAILED"
    assert by_id["lateral_meniscus"]["status"] == "unsupported"
    assert by_id["lateral_meniscus"]["reason"]["code"] == "NOT_SUPPORTED"
    assert body["provenance"]["source"] == "fixture"
    assert "FIXTURE" in body["provenance"]["notice"]
    assert body["model"]["checkpoint_sha256"] is None
    assert {i["plane"] for i in body["inputs"]} == {"sagittal", "coronal", "axial"}


def test_missing_plane_studies_match_the_fixture_table():
    # fx-study-002: viewer shows a missing plane.
    assert client.get("/studies/fx-study-002").json()["missing_planes"] == ["axial"]
    # fx-study-004: supported findings unavailable, unsupported finding stays unsupported.
    body = client.post("/predictions", json={"study_id": "fx-study-004"}).json()
    by_id = {f["finding_id"]: f for f in body["findings"]}
    for finding_id in ("acl", "mcl", "medial_meniscus"):
        assert by_id[finding_id]["status"] == "unavailable"
        assert by_id[finding_id]["reason"]["code"] == "INPUT_INVALID"
    assert by_id["lateral_meniscus"]["status"] == "unsupported"


def test_fixture_study_table_matches_the_catalogue():
    listed = {s["study_id"] for s in client.get("/studies").json()["studies"]}
    documented = set(re.findall(r"fx-study-\d+", _section("## 9. Fixture studies", "## 10.")))
    assert documented == listed


def test_explanations_are_available_and_unavailable_as_documented():
    ok = client.get(EXPLANATION_URL).json()
    assert ok["status"] == "available" and ok["kind"] == "influential_slices"
    assert ok["prediction_id"] == PREDICTION_ID and ok["slices"]
    assert "does not localise" in ok["notice"]
    missing = client.get(f"/studies/fx-study-001/explanations/mcl?prediction_id={PREDICTION_ID}").json()
    assert missing["status"] == "unavailable"
    assert missing["reason"]["code"] == "EXPLANATION_UNAVAILABLE"
    assert not missing["slices"] and not missing["attention"]


def test_labels_match_the_documented_example():
    body = client.get("/studies/fx-study-001/labels").json()
    states = {label["finding_id"]: label["state"] for label in body["labels"]}
    assert states == {
        "acl": "positive",
        "mcl": "negative",
        "medial_meniscus": "unknown",
        "lateral_meniscus": "not_labeled",
    }
    assert "never used by the model" in body["notice"]


def test_metrics_are_unavailable_as_documented():
    body = client.get("/metrics").json()
    assert body["status"] == "unavailable" and body["reason"]
    assert body["per_finding"] == [] and body["macro_roc_auc"] is None


def test_model_card_matches_the_documented_fields():
    body = client.get("/model-card").json()
    assert body["status"] == "draft" and body["origin"] == "fixture"
    assert body["sections"] and body["limitations"]


def test_slice_png_headers_match_the_documented_contract():
    resp = client.get("/studies/fx-study-001/series/fx-ser-01/slices/0")
    assert resp.headers["content-type"] == "image/png"
    assert resp.headers["cache-control"] == "private, max-age=3600"
    assert resp.headers["x-kneescope-origin"] == "fixture"


def test_health_body_matches_the_documented_example():
    """Field set of the live response equals the JSON example in §5.1."""
    example = _section("### 5.1", "### 5.2")
    block = example.split("```json", 1)[1].split("```", 1)[0]
    documented_keys = set(json.loads(block))
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert set(resp.json()) == documented_keys


# --------------------------------------------------------------------------
# Documented 503 for fixture-only endpoints
# --------------------------------------------------------------------------


def test_fixture_only_endpoints_return_documented_503_outside_fixture_mode():
    """require_fixture_mode as documented; integration coverage in test_catalogue.py."""
    app = create_app()
    state = app.state.ks
    app.state.ks = dataclasses.replace(state, settings=dataclasses.replace(state.settings, mode="model"))
    model_client = TestClient(app)
    cases = [
        ("POST", "/predictions", {"study_id": "fx-study-001"}, None),
        ("GET", "/studies/fx-study-001/explanations/acl", None, {"prediction_id": PREDICTION_ID}),
        ("GET", "/studies/fx-study-001/labels", None, None),
        ("GET", "/metrics", None, None),
        ("GET", "/model-card", None, None),
    ]
    for method, url, body, params in cases:
        resp = model_client.request(method, url, json=body, params=params)
        assert resp.status_code == 503, f"{method} {url}: {resp.text}"
        assert resp.json()["error"]["code"] == "MODEL_NOT_LOADED"
    assert "503" in doc_error_rows()["MODEL_NOT_LOADED"]


# --------------------------------------------------------------------------
# The doc must document every code and enum value
# --------------------------------------------------------------------------


def test_error_table_documents_every_error_code():
    section = _section("## 6. Error handling in the UI", "## 7.")
    missing = [code.value for code in ErrorCode if code.value not in section]
    assert not missing, f"docs/api.md §6 does not document: {missing}"


@pytest.mark.parametrize(
    "enum_cls",
    [
        Plane,
        DataOrigin,
        ResultSource,
        FindingStatus,
        ScoreKind,
        AnalysisStatus,
        LabelState,
        LabelProvenance,
        SliceOrder,
    ],
)
def test_enum_values_are_documented(enum_cls):
    missing = [value.value for value in enum_cls if value.value not in DOC_TEXT]
    assert not missing, f"docs/api.md does not document {enum_cls.__name__}: {missing}"


def test_metric_value_statuses_are_documented():
    statuses = get_args(MetricValue.model_fields["status"].annotation)
    missing = [s for s in statuses if s not in DOC_TEXT]
    assert not missing, f"docs/api.md does not document MetricValue statuses: {missing}"
