"""KS-DATA-10: demo manifest from evaluation partitions only."""

import csv
import json
import subprocess
import sys
from pathlib import Path

import pytest

pytest.importorskip("pydicom")

from kneescope_contracts.models import StudyDetail
from kneescope_ml.synthetic_rsna import SyntheticSpec, write_synthetic_rsna

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def setup(tmp_path):
    data = tmp_path / "rsna"
    studies = list(write_synthetic_rsna(data, SyntheticSpec(n_studies=8, missing_plane={5: "Axial"})))
    split = tmp_path / "split.csv"
    parts = ["train", "train", "train", "validation", "validation", "test", "test", "validation"]
    with split.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["study_id", "partition", "group_hash"])
        w.writerows([s, p, "x"] for s, p in zip(studies, parts, strict=True))
    return data, split, dict(zip(studies, parts, strict=True)), tmp_path


def run(data, split, out, n=4):
    return subprocess.run(
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
            str(n),
            "--out",
            str(out),
        ],
        capture_output=True,
        text=True,
    )


def test_manifest_validates_and_excludes_training(setup):
    data, split, parts, tmp = setup
    out = tmp / "manifest.json"
    assert run(data, split, out).returncode == 0
    studies = [StudyDetail.model_validate(s) for s in json.loads(out.read_text())["studies"]]
    assert len(studies) == 4 and all(s.origin == "dataset" for s in studies)
    assert all(parts[s.study_id] in {"validation", "test"} for s in studies)
    assert any(s.missing_planes for s in studies)
    selection = json.loads(out.with_suffix(".selection.json").read_text())
    assert {e["partition"] for e in selection["studies"]} <= {"validation", "test"}


def test_rejects_sizes_outside_three_to_five(setup):
    data, split, _, tmp = setup
    assert run(data, split, tmp / "m.json", n=6).returncode != 0
