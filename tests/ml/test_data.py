"""KS-DATA-09: versioned tensor cache and dataset."""

import csv
import dataclasses
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from kneescope_ml.adapters.fixture import FixtureAdapter
from kneescope_ml.config import load_preprocessing_config
from kneescope_ml.data import (
    CachedStudyDataset,
    StaleCacheError,
    cache_path,
    label_vector,
    load_cached,
    write_cached,
)
from kneescope_ml.preprocess import preprocess_study

ROOT = Path(__file__).resolve().parents[2]
CFG = load_preprocessing_config()


def preprocessed(study_id="fx-study-002"):
    a = FixtureAdapter()
    series = {p: a.load_series(study_id, r.series_id) for p, r in a.select_series(study_id).items()}
    return preprocess_study(study_id, series, CFG)


def test_round_trip_preserves_tensors_masks_and_mapping(tmp_path):
    study = preprocessed()
    loaded = load_cached(write_cached(study, tmp_path, CFG), CFG)
    for plane, pt in study.planes.items():
        got = loaded.planes[plane]
        assert got.volume.dtype == np.float32 and np.array_equal(got.volume, pt.volume)
        assert np.array_equal(got.mask, pt.mask) and got.present == pt.present
        assert np.array_equal(got.source_slice_index, pt.source_slice_index)
    assert loaded.warnings == study.warnings  # "axial series missing"


def test_entry_from_another_preprocessing_version_is_rejected(tmp_path):
    path = write_cached(preprocessed(), tmp_path, CFG)
    other = dataclasses.replace(CFG, version="prep-9.9.9", sha256="f" * 64)
    with pytest.raises(StaleCacheError):
        load_cached(path, other)


def test_unknown_labels_are_masked_not_negative():
    y, known = label_vector(
        {"acl": "positive", "mcl": "unknown", "medial_meniscus": "negative"},
        ["acl", "mcl", "medial_meniscus", "lateral_meniscus"],
    )
    assert y.tolist() == [1.0, 0.0, 0.0, 0.0]
    assert known.tolist() == [True, False, True, False]


def test_dataset_yields_contract_shapes_and_requires_cache(tmp_path):
    study = preprocessed()
    write_cached(study, tmp_path, CFG)
    ds = CachedStudyDataset(
        [study.study_id], {study.study_id: {"acl": "negative"}}, ["acl", "mcl"], tmp_path, CFG
    )
    pre, _y, known = ds[0]
    assert len(ds) == 1 and pre.planes["sagittal"].volume.shape == (CFG.num_slices, CFG.height, CFG.width)
    assert known.tolist() == [True, False]
    with pytest.raises(FileNotFoundError):
        CachedStudyDataset(["not-cached"], {}, ["acl"], tmp_path, CFG)


def test_cli_builds_partition_resumes_and_skips_corrupt(tmp_path):
    pytest.importorskip("pydicom")
    from kneescope_ml.synthetic_rsna import SyntheticSpec, write_synthetic_rsna

    data = tmp_path / "rsna"
    studies = list(write_synthetic_rsna(data, SyntheticSpec(n_studies=4, corrupt={3: "truncated"})))
    split = tmp_path / "split.csv"
    with split.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["study_id", "partition", "group_hash"])
        for i, s in enumerate(studies):
            w.writerow([s, "validation" if i == 0 else "train", "x"])
    cmd = [
        sys.executable,
        str(ROOT / "scripts/cache_tensors.py"),
        "--dataset",
        "rsna",
        "--root",
        str(data),
        "--split-file",
        str(split),
        "--partition",
        "train",
        "--out",
        str(tmp_path / "cache"),
    ]
    first = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    assert "2 built, 0 already valid, 1 failed" in first and "studies/s" in first
    assert studies[3] not in first  # failures are reported by index, not UID
    second = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    assert "0 built, 2 already valid" in second
    assert not cache_path(tmp_path / "cache", studies[0], CFG).exists()  # validation not cached
