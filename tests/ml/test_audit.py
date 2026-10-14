"""KS-DATA-03: audit counts on a synthetic RSNA-layout dataset."""

import json
import subprocess
import sys
from pathlib import Path

import pytest

pytest.importorskip("pydicom")

from kneescope_ml.audit import RSNA_LABELS, audit_rsna, markdown_tables
from kneescope_ml.synthetic_rsna import SyntheticSpec, write_synthetic_rsna

ROOT = Path(__file__).resolve().parents[2]
SPEC = SyntheticSpec(
    n_studies=6, labelled_fraction=0.5, patients=4, missing_plane={4: "Axial"}, corrupt={5: "truncated"}
)


@pytest.fixture(scope="module")
def synthetic(tmp_path_factory):
    root = tmp_path_factory.mktemp("rsna")
    studies = write_synthetic_rsna(root, SPEC)
    return root, studies


def test_label_counts_partition_every_study(synthetic):
    root, _ = synthetic
    report = audit_rsna(root)
    assert report["studies_in_train_csv"] == 6 and report["labelled_studies"] == 3
    for name in RSNA_LABELS:
        c = report["labels"][name]
        assert sum(c.values()) == 6
        assert c.get("not_labeled", 0) == 3  # unlabelled studies are never negatives


def test_planes_series_slices_and_grouping(synthetic):
    root, _ = synthetic
    report = audit_rsna(root)
    assert report["studies_with_plane"] == {"sagittal": 6, "coronal": 6, "axial": 5}
    assert report["series_per_study"]["max"] == 4 and report["slices_per_series"]["median"] == 8
    assert report["grouping"]["distinct_patient_ids"] == 4
    assert "PatientID" in report["grouping"]["fields_present"]
    assert report["transfer_syntaxes_sampled"] == {"Explicit VR Little Endian": 23}


def test_corrupt_file_is_counted_not_raised(synthetic):
    root, _ = synthetic
    report = audit_rsna(root, header_sample_per_series=8, decode_sample_per_series=8)
    assert report["unreadable_files_sampled"] + report["undecodable_files_sampled"] >= 1


def test_report_has_no_identifiers_or_report_text(synthetic):
    root, studies = synthetic
    text = json.dumps(audit_rsna(root)) + markdown_tables(audit_rsna(root))
    assert not any(uid in text for uid in studies)
    assert "SYNTHETIC REPORT" not in text and "SYNTH-P" not in text


def test_cli_rerun_is_identical(synthetic, tmp_path):
    root, _ = synthetic
    outs = []
    for name in ("a.json", "b.json"):
        out = tmp_path / name
        subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts/audit_dataset.py"),
                "--dataset",
                "rsna",
                "--root",
                str(root),
                "--out",
                str(out),
            ],
            check=True,
            capture_output=True,
        )
        outs.append(out.read_text())
    assert outs[0] == outs[1]
