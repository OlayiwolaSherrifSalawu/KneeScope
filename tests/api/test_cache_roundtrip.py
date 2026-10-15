"""KS-EVAL-07: manifest predictions are precomputed once and served as 'cached'.

Needs the ml extras (torch, pydicom) because the live path runs a real checkpoint over
real preprocessing; the test checkpoint is generated in-process with untrained weights
(plumbing only — its scores are meaningless by design and never leave this test).
"""

from __future__ import annotations

import csv
import importlib.util
import json
import logging
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

import pytest

pytest.importorskip("torch")
pytest.importorskip("pydicom")

import torch
from fastapi.testclient import TestClient

from kneescope_api.cache import PredictionCache
from kneescope_api.main import create_app
from kneescope_api.settings import Settings
from kneescope_contracts.findings import default_profile_id, load_profile
from kneescope_contracts.models import ResultSource
from kneescope_ml.config import load_model_config, load_preprocessing_config
from kneescope_ml.inference import sha256_file
from kneescope_ml.model import ModelSpec, StudyModel
from kneescope_ml.synthetic_rsna import SyntheticSpec, write_synthetic_rsna

ROOT = Path(__file__).resolve().parents[2]
PREP_VERSION = "prep-cache-test-0"
MODEL_VERSION = "0.0.1-plumbing"

PREP_TOML = f"""\
version = "{PREP_VERSION}"
status = "placeholder"

[input]
planes = ["sagittal", "coronal", "axial"]
num_slices = 4
height = 64
width = 64
dtype = "float32"
layout = "S,H,W"
slice_sampling = "uniform_centered"
slice_order = "patient_position"
resize = "bilinear_preserve_aspect_pad"
orientation = "dicom_lps_as_acquired"

[input.normalization]
method = "percentile_clip_zscore"
p_low = 0.5
p_high = 99.5

[render]
max_size = 128
p_low = 0.5
p_high = 99.5
"""


def _import_precompute():
    spec = importlib.util.spec_from_file_location(
        "precompute_predictions", ROOT / "scripts/precompute_predictions.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _settings(manifest: Path, data_root: Path) -> Settings:
    return Settings(
        mode="model",
        finding_profile=default_profile_id(),
        cors_origins=(),
        log_level="warning",
        manifest=manifest,
        data_root=data_root,
        dataset=None,
    )


@pytest.fixture(scope="module")
def env(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("cache-roundtrip")
    data = tmp / "rsna"
    studies = list(write_synthetic_rsna(data, SyntheticSpec(n_studies=6, slices=4, size=32)))
    split = tmp / "split.csv"
    parts = ["train", "train", "train", "validation", "test", "validation"]
    with split.open("w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["study_id", "partition", "group_hash"])
        writer.writerows([s, p, "x"] for s, p in zip(studies, parts, strict=True))
    manifest = tmp / "manifest.json"
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
            "3",
            "--out",
            str(manifest),
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    checkpoint = tmp / "checkpoint.pt"
    spec = ModelSpec(
        planes=("sagittal", "coronal", "axial"),
        findings=tuple(f.finding_id for f in load_profile(default_profile_id()).findings),
    )
    torch.manual_seed(0)
    torch.save(
        {"model": StudyModel(spec).state_dict(), "optimizer": None, "step": 0, "spec": asdict(spec)},
        checkpoint,
    )
    cache_dir = tmp / "prediction-cache"
    prep_toml = tmp / "preprocessing.toml"
    prep_toml.write_text(PREP_TOML, encoding="utf-8")
    model_toml = tmp / "model.toml"
    model_toml.write_text(
        f"""\
[model]
model_id = "tiny-demo-checkpoint"
model_version = "{MODEL_VERSION}"
checkpoint_path = "{checkpoint}"
checkpoint_sha256 = "{sha256_file(checkpoint)}"
finding_profile = "interaction_prototype"
required_planes = ["sagittal"]
trained_on = "untrained synthetic weights - plumbing demo only, scores meaningless"

[serving]
mode = "sync"
request_timeout_s = 8.0
cache_dir = "{cache_dir}"

[fixture_model]
model_id = "ks-fixture-v0"
model_version = "0.0.0"
unsupported_findings = []
""",
        encoding="utf-8",
    )
    return {
        "tmp": tmp,
        "data": data,
        "manifest": manifest,
        "model_toml": model_toml,
        "prep_toml": prep_toml,
        "cache_dir": cache_dir,
    }


def _manifest_ids(manifest: Path) -> list[str]:
    return [s["study_id"] for s in json.loads(manifest.read_text(encoding="utf-8"))["studies"]]


def _app(env, prep_cfg=None):
    return create_app(
        _settings(env["manifest"], env["data"]),
        model_cfg=load_model_config(env["model_toml"]),
        prep_cfg=prep_cfg or load_preprocessing_config(env["prep_toml"]),
    )


@pytest.fixture(scope="module")
def cached_client(env):
    """Run the precompute script once, then serve a fresh app over the same cache dir."""
    module = _import_precompute()
    assert module.run(env["manifest"], env["data"], env["model_toml"], env["prep_toml"]) == 0
    with TestClient(_app(env)) as client:
        yield client


def test_every_manifest_study_is_served_as_cached(env, cached_client):
    ids = _manifest_ids(env["manifest"])
    assert len(ids) == 3  # two complete studies and one with a missing plane
    checkpoint_sha = sha256_file(env["tmp"] / "checkpoint.pt")
    for study_id in ids:
        body = cached_client.post("/predictions", json={"study_id": study_id}).json()
        provenance = body["provenance"]
        assert provenance["source"] == ResultSource.cached
        assert provenance["cache_key"] and provenance["latency_ms"] is None
        assert provenance["computed_at"] < provenance["served_at"]  # computed before served
        assert body["model"]["checkpoint_sha256"] == checkpoint_sha
        assert body["model"]["model_version"] == MODEL_VERSION
        assert body["preprocessing"]["version"] == PREP_VERSION
        assert body["findings"] and all(f["status"] == "scored" for f in body["findings"])
    assert len(list(env["cache_dir"].glob("*.json"))) == len(ids)  # one entry per study


def test_allow_cached_false_forces_the_live_path(env, cached_client):
    study_id = _manifest_ids(env["manifest"])[0]
    body = cached_client.post("/predictions", json={"study_id": study_id, "allow_cached": False}).json()
    provenance = body["provenance"]
    assert provenance["source"] == ResultSource.live
    assert provenance["cache_key"] is None and provenance["latency_ms"] > 0
    assert provenance["computed_at"] == provenance["served_at"]


def test_subset_request_hits_the_cache_and_filters(env, cached_client):
    study_id = _manifest_ids(env["manifest"])[0]
    body = cached_client.post("/predictions", json={"study_id": study_id, "findings": ["acl"]}).json()
    assert body["provenance"]["source"] == ResultSource.cached
    assert [f["finding_id"] for f in body["findings"]] == ["acl"]


def test_changing_preprocessing_version_misses_the_cache(env, cached_client):
    bumped = env["tmp"] / "preprocessing-v2.toml"
    bumped.write_text(PREP_TOML.replace(PREP_VERSION, "prep-cache-test-1"), encoding="utf-8")
    with TestClient(_app(env, load_preprocessing_config(bumped))) as client:
        for study_id in _manifest_ids(env["manifest"]):
            body = client.post("/predictions", json={"study_id": study_id}).json()
            assert body["provenance"]["source"] == ResultSource.live  # stale key: miss by design
            assert body["preprocessing"]["version"] == "prep-cache-test-1"
    assert len(list(env["cache_dir"].glob("*.json"))) == 3  # old entries untouched, not rewritten


def test_tampered_cache_entry_is_ignored_and_logged_without_content(env, cached_client, caplog):
    study_id = _manifest_ids(env["manifest"])[0]
    key = PredictionCache.key(
        study_id,
        MODEL_VERSION,
        sha256_file(env["tmp"] / "checkpoint.pt"),
        PREP_VERSION,
        default_profile_id(),
    )
    entry = env["cache_dir"] / f"{key}.json"
    entry.write_text('{"tampered": true}', encoding="utf-8")
    caplog.set_level(logging.WARNING)
    body = cached_client.post("/predictions", json={"study_id": study_id}).json()
    assert body["provenance"]["source"] == ResultSource.live  # invalid entry: miss
    assert "invalid prediction cache entry" in caplog.text
    assert "tampered" not in caplog.text
