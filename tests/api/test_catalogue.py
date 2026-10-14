"""KS-API-01: dataset-backed study catalogue and slice rendering in model mode."""

import csv
import io
import json
import logging
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

pytest.importorskip("pydicom")

from kneescope_api.main import create_app
from kneescope_api.settings import Settings, load_settings
from kneescope_contracts.models import StudyList
from kneescope_ml.synthetic_rsna import SyntheticSpec, write_synthetic_rsna

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def model_app(tmp_path_factory):
    base = tmp_path_factory.mktemp("rsna-model-mode")
    data = base / "data"
    studies = list(
        write_synthetic_rsna(
            data, SyntheticSpec(n_studies=6, missing_plane={4: "Axial"}, corrupt={5: "truncated"})
        )
    )
    split = base / "split.csv"
    with split.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["study_id", "partition", "group_hash"])
        for i, s in enumerate(studies):
            w.writerow([s, "train" if i < 2 else "validation", "x"])
    manifest = base / "manifest.json"
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/build_manifest.py"),
            "--dataset",
            "rsna",
            "--root",
            str(data),
            "--split-file",
            str(split),
            "--n",
            "4",
            "--out",
            str(manifest),
        ],
        check=True,
        capture_output=True,
    )
    settings = Settings(
        mode="model",
        finding_profile="interaction_prototype",
        cors_origins=(),
        log_level="info",
        manifest=manifest,
        data_root=data,
    )
    return TestClient(create_app(settings)), data, json.loads(manifest.read_text())["studies"]


def test_model_mode_lists_dataset_studies(model_app):
    client, _, manifest = model_app
    body = client.get("/studies").json()
    listed = StudyList.model_validate(body)
    assert {s.study_id for s in listed.studies} == {m["study_id"] for m in manifest}
    assert all(s.origin.value == "dataset" for s in listed.studies)
    assert body["origin_notice"] is None


def test_slice_png_matches_manifest_rendered_size(model_app):
    client, _, manifest = model_app
    study = manifest[0]
    series = study["series"][0]
    resp = client.get(f"/studies/{study['study_id']}/series/{series['series_id']}/slices/0")
    assert resp.status_code == 200 and resp.headers["x-kneescope-origin"] == "dataset"
    assert Image.open(io.BytesIO(resp.content)).size == (series["rendered_width"], series["rendered_height"])


def test_slice_out_of_range(model_app):
    client, _, manifest = model_app
    study, series = manifest[0], manifest[0]["series"][0]
    path = f"/studies/{study['study_id']}/series/{series['series_id']}/slices/{series['num_slices']}"
    resp = client.get(path)
    assert resp.status_code == 404 and resp.json()["error"]["code"] == "SLICE_OUT_OF_RANGE"


def test_inference_routes_fail_loudly_in_model_mode(model_app):
    client, _, manifest = model_app
    resp = client.post("/predictions", json={"study_id": manifest[0]["study_id"]})
    assert resp.status_code == 503 and resp.json()["error"]["code"] == "MODEL_NOT_LOADED"
    assert client.get("/metrics").status_code == 503


def test_no_response_or_log_leaks_the_data_root(model_app, caplog):
    client, data, manifest = model_app
    texts = []
    with caplog.at_level(logging.DEBUG):
        texts.append(client.get("/studies").text)
        for study in manifest:
            texts.append(client.get(f"/studies/{study['study_id']}").text)
            for series in study["series"]:
                r = client.get(f"/studies/{study['study_id']}/series/{series['series_id']}/slices/0")
                if r.headers["content-type"].startswith("application/json"):
                    texts.append(r.text)
        texts.append(client.get("/studies/not-a-study").text)
    combined = "\n".join(texts) + caplog.text
    assert str(data) not in combined and str(data.parent) not in combined


def test_corrupt_series_returns_safe_preprocessing_error(tmp_path):
    data = tmp_path / "data"
    studies = list(write_synthetic_rsna(data, SyntheticSpec(n_studies=1, corrupt={0: "truncated"})))
    split = tmp_path / "split.csv"
    split.write_text(f"study_id,partition,group_hash\n{studies[0]},validation,x\n")
    # Manifest of one corrupt study, built directly (build_manifest needs >= 3 studies).
    from importlib import util

    spec = util.spec_from_file_location("bm", ROOT / "scripts/build_manifest.py")
    assert spec and spec.loader
    bm = util.module_from_spec(spec)
    spec.loader.exec_module(bm)
    from kneescope_ml.adapters.rsna import RsnaAdapter

    detail = bm.study_detail(RsnaAdapter(data), studies[0], "Demo study 1", 512)
    manifest = tmp_path / "m.json"
    manifest.write_text(json.dumps({"studies": [detail.model_dump(mode="json")]}))
    client = TestClient(
        create_app(
            Settings(
                mode="model",
                finding_profile="interaction_prototype",
                cors_origins=(),
                log_level="info",
                manifest=manifest,
                data_root=data,
            )
        )
    )
    sag = next(s for s in detail.series if s.plane and s.plane.value == "sagittal" and s.fluid_sensitive)
    resp = client.get(f"/studies/{studies[0]}/series/{sag.series_id}/slices/0")
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "PREPROCESSING_FAILED"
    assert str(tmp_path) not in resp.text


def test_model_mode_requires_manifest_and_data_root(monkeypatch):
    monkeypatch.setenv("KNEESCOPE_MODE", "model")
    monkeypatch.delenv("KNEESCOPE_MANIFEST", raising=False)
    monkeypatch.setenv("KNEESCOPE_DATA_ROOT", "/secret/location")
    with pytest.raises(ValueError) as err:
        load_settings()
    assert "KNEESCOPE_MANIFEST" in str(err.value) and "/secret/location" not in str(err.value)
