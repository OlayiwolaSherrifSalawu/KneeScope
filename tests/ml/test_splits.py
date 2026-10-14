"""KS-DATA-08: grouped, deterministic splits without leakage."""

import random
import subprocess
import sys
from pathlib import Path

import pytest

from kneescope_ml.splits import (
    LeakageError,
    check_no_leakage,
    make_splits,
    partition_counts,
)

ROOT = Path(__file__).resolve().parents[2]
FINDINGS = ["acl", "mcl", "medial_meniscus", "lateral_meniscus"]


def cohort(n_patients=60, studies_per_patient=2, seed=1):
    rng = random.Random(seed)
    groups, labels = {}, {}
    for p in range(n_patients):
        for k in range(studies_per_patient):
            s = f"s{p:03d}-{k}"
            groups[s] = f"p{p:03d}"
            labels[s] = {f: rng.choice(["positive", "negative", "negative", "unknown"]) for f in FINDINGS}
    return groups, labels


def test_same_seed_same_hash_different_seed_differs():
    groups, labels = cohort()
    a = make_splits(groups, labels, FINDINGS, seed=2026)
    b = make_splits(groups, labels, FINDINGS, seed=2026)
    c = make_splits(groups, labels, FINDINGS, seed=7)
    assert a.split_hash == b.split_hash and a.assignment == b.assignment
    assert c.split_hash != a.split_hash


def test_patients_never_span_partitions():
    groups, labels = cohort(studies_per_patient=3)
    result = make_splits(groups, labels, FINDINGS, seed=2026)
    by_patient = {}
    for s, part in result.assignment.items():
        by_patient.setdefault(groups[s], set()).add(part)
    assert all(len(parts) == 1 for parts in by_patient.values())


def test_leaky_input_is_rejected():
    groups = {"s1": "p1", "s2": "p1", "s3": "p2"}
    with pytest.raises(LeakageError):
        check_no_leakage({"s1": "train", "s2": "test", "s3": "train"}, groups)


def test_fractions_roughly_respected_and_positives_spread():
    groups, labels = cohort(n_patients=200, studies_per_patient=1)
    result = make_splits(groups, labels, FINDINGS, seed=2026)
    counts = partition_counts(result.assignment, labels, FINDINGS)
    sizes = {p: counts[p]["acl"]["studies"] for p in counts}
    assert 120 <= sizes["train"] <= 160 and 20 <= sizes["validation"] <= 40
    for f in FINDINGS:
        assert counts["validation"][f]["positive"] >= 1 and counts["validation"][f]["negative"] >= 1


def test_unknown_is_never_counted_as_negative():
    labels = {"a": {"acl": "unknown"}, "b": {"acl": "not_labeled"}}
    counts = partition_counts({"a": "train", "b": "train"}, labels, ["acl"])
    assert counts["train"]["acl"] == {"positive": 0, "negative": 0, "unknown": 2, "studies": 2}


def test_validation_only_design():
    groups, labels = cohort()
    result = make_splits(groups, labels, FINDINGS, seed=1, fractions=(0.8, 0.2, 0.0))
    assert "test" not in set(result.assignment.values())


def test_cli_hash_check_and_privacy(tmp_path):
    pytest.importorskip("pydicom")
    from kneescope_ml.synthetic_rsna import SyntheticSpec, write_synthetic_rsna

    data = tmp_path / "rsna"
    write_synthetic_rsna(data, SyntheticSpec(n_studies=8, patients=5, labelled_fraction=1.0))
    out = tmp_path / "splits"
    cmd = [
        sys.executable,
        str(ROOT / "scripts/make_splits.py"),
        "--dataset",
        "rsna",
        "--root",
        str(data),
        "--out-dir",
        str(out),
        "--seed",
        "2026",
    ]
    first = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    digest = first.split("split hash ")[1].split()[0]
    again = subprocess.run([*cmd, "--expect-hash", digest], capture_output=True, text=True)
    assert again.returncode == 0
    wrong = subprocess.run([*cmd, "--expect-hash", "0" * 64], capture_output=True, text=True)
    assert wrong.returncode == 1
    written = (out / "rsna-rsna4-seed2026.csv").read_text()
    assert "SYNTH-P" not in written  # patient IDs are hashed, never written
