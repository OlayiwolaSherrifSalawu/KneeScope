"""API behaviour in fixture mode."""

import io

from fastapi.testclient import TestClient
from PIL import Image

from kneescope_api.main import create_app

client = TestClient(create_app())


def test_health_reports_fixture_mode_and_versions():
    body = client.get("/healthz").json()
    assert body["status"] == "ok"
    assert body["mode"] == "fixture"
    assert body["model_loaded"] is False
    assert body["preprocessing_version"].startswith("prep-")


def test_openapi_lists_contract_routes():
    paths = set(client.get("/openapi.json").json()["paths"])
    assert {
        "/healthz",
        "/studies",
        "/studies/{study_id}",
        "/predictions",
        "/metrics",
        "/model-card",
        "/studies/{study_id}/series/{series_id}/slices/{index}",
        "/studies/{study_id}/explanations/{finding_id}",
        "/studies/{study_id}/labels",
    } <= paths


def test_studies_are_marked_fixture():
    body = client.get("/studies").json()
    assert body["studies"] and all(s["origin"] == "fixture" for s in body["studies"])
    assert "FIXTURE" in body["origin_notice"]


def test_missing_plane_is_explicit():
    detail = client.get("/studies/fx-study-002").json()
    assert detail["missing_planes"] == ["axial"]


def test_slice_png_matches_declared_size():
    detail = client.get("/studies/fx-study-001").json()
    series = detail["series"][0]
    resp = client.get(f"/studies/fx-study-001/series/{series['series_id']}/slices/0")
    assert resp.status_code == 200 and resp.headers["content-type"] == "image/png"
    img = Image.open(io.BytesIO(resp.content))
    assert img.size == (series["rendered_width"], series["rendered_height"])


def test_slice_out_of_range_is_structured_error():
    resp = client.get("/studies/fx-study-001/series/fx-ser-01/slices/999")
    assert resp.status_code == 404
    err = resp.json()["error"]
    assert err["code"] == "SLICE_OUT_OF_RANGE" and err["request_id"] == resp.headers["x-request-id"]


def test_fixture_prediction_distinguishes_all_states():
    body = client.post("/predictions", json={"study_id": "fx-study-001"}).json()
    assert body["provenance"]["source"] == "fixture"
    assert "FIXTURE" in body["provenance"]["notice"]
    assert body["model"]["checkpoint_sha256"] is None
    status = {f["finding_id"]: f["status"] for f in body["findings"]}
    assert status == {
        "acl": "scored",
        "mcl": "scored",
        "medial_meniscus": "failed",
        "lateral_meniscus": "unsupported",
    }
    mcl = next(f for f in body["findings"] if f["finding_id"] == "mcl")
    assert mcl["score"] < 0.1 and mcl["reason"] is None  # low score, not a failure


def test_missing_required_plane_makes_findings_unavailable():
    body = client.post("/predictions", json={"study_id": "fx-study-004"}).json()
    supported = [f for f in body["findings"] if f["status"] != "unsupported"]
    assert supported and all(f["status"] == "unavailable" for f in supported)
    assert all(f["reason"]["code"] == "INPUT_INVALID" for f in supported)


def test_study_level_failure_returns_no_scores():
    resp = client.post("/predictions", json={"study_id": "fx-study-003"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "PREPROCESSING_FAILED"
    assert "findings" not in resp.json()


def test_unknown_study_and_finding():
    assert client.post("/predictions", json={"study_id": "nope"}).json()["error"]["code"] == "STUDY_NOT_FOUND"
    resp = client.post("/predictions", json={"study_id": "fx-study-001", "findings": ["acl_tear"]})
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "FINDING_NOT_IN_PROFILE"


def test_validation_errors_do_not_echo_body():
    resp = client.post("/predictions", json={"study_id": 5, "secret": "report text"})
    assert resp.status_code == 422
    assert "report text" not in resp.text


def test_explanations_available_and_unavailable():
    pid = "fx-pred-fx-study-001-interaction_prototype"
    ok = client.get("/studies/fx-study-001/explanations/acl", params={"prediction_id": pid}).json()
    assert ok["status"] == "available" and ok["coordinate_space"] == "rendered_slice_pixels"
    assert "does not localise" in ok["notice"]
    missing = client.get("/studies/fx-study-001/explanations/mcl", params={"prediction_id": pid}).json()
    assert missing["status"] == "unavailable" and missing["reason"]["code"] == "EXPLANATION_UNAVAILABLE"


def test_labels_are_separate_and_fixture_marked():
    body = client.get("/studies/fx-study-001/labels").json()
    assert body["origin"] == "fixture"
    assert all(label["provenance"] == "fixture" for label in body["labels"])


def test_metrics_never_fabricated_in_fixture_mode():
    body = client.get("/metrics").json()
    assert body["status"] == "unavailable" and body["per_finding"] == []


def test_readyz_and_client_request_id():
    resp = client.get("/readyz", headers={"X-Request-ID": "client-123"})
    assert resp.status_code == 200 and resp.json()["mode"] == "fixture"
    assert resp.headers["x-request-id"] == "client-123"
    bad = client.get("/healthz", headers={"X-Request-ID": "bad id with spaces"})
    assert bad.headers["x-request-id"].startswith("req-")
