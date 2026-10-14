"""KS-DATA-05 / KS-DATA-06: RSNA adapter on synthetic RSNA-layout DICOMs."""

import csv
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("pydicom")

from kneescope_ml.adapters.rsna import RsnaAdapter, plane_from_orientation
from kneescope_ml.preprocess import PreprocessingError
from kneescope_ml.synthetic_rsna import (
    ORIENTATION,
    SLICE_CODE_BASE,
    SyntheticSpec,
    write_synthetic_rsna,
)

ROOT = Path(__file__).resolve().parents[2]


def centre_codes(pixels: np.ndarray) -> list[int]:
    c = pixels.shape[1] // 2
    return [round(float(v)) for v in pixels[:, c, c]]


@pytest.fixture
def dataset(tmp_path):
    studies = write_synthetic_rsna(tmp_path, SyntheticSpec(n_studies=3, missing_plane={2: "Axial"}))
    return tmp_path, studies


def test_orders_by_position_not_filename_or_instance_number(dataset):
    root, studies = dataset
    adapter = RsnaAdapter(root)
    study = next(iter(studies))
    for ref in adapter.list_series(study):
        vol = adapter.load_series(study, ref.series_id)
        assert vol.slice_order == "patient_position"
        assert centre_codes(vol.pixels) == [SLICE_CODE_BASE + 10 * k for k in range(8)]
        assert vol.warnings == ()


def test_plane_mismatch_gives_none_and_warning(dataset):
    root, _studies = dataset
    rows = list(csv.DictReader((root / "train_series.csv").open()))
    target = next(r for r in rows if r["Anatomical_Plane"] == "Coronal")
    target["Anatomical_Plane"] = "Axial"  # wrong label for a coronal acquisition
    with (root / "train_series.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    vol = RsnaAdapter(root).load_series(target["StudyInstanceUID"], target["SeriesInstanceUID"])
    assert vol.plane is None
    assert any("disagrees with orientation" in w for w in vol.warnings)


def test_series_selection_prefers_fluid_sensitive_and_one_per_plane(dataset):
    root, studies = dataset
    adapter = RsnaAdapter(root)
    study = next(iter(studies))
    refs = adapter.list_series(study)
    assert sum(r.plane == "sagittal" for r in refs) == 2  # PD FS and T1
    chosen = adapter.select_series(study)
    assert set(chosen) == {"sagittal", "coronal", "axial"}
    assert chosen["sagittal"].fluid_sensitive is True


def test_missing_plane_is_simply_absent(dataset):
    root, studies = dataset
    third = list(studies)[2]
    assert "axial" not in RsnaAdapter(root).select_series(third)


@pytest.mark.parametrize("syntax", ["explicit", "implicit", "rle", "jpeg2000"])
def test_decodes_each_transfer_syntax(tmp_path, syntax):
    studies = write_synthetic_rsna(
        tmp_path, SyntheticSpec(n_studies=1, transfer_syntax=syntax, extra_sagittal_t1=False)
    )
    study = next(iter(studies))
    adapter = RsnaAdapter(tmp_path)
    ref = adapter.select_series(study)["sagittal"]
    assert centre_codes(adapter.load_series(study, ref.series_id).pixels)[:3] == [100, 110, 120]


def test_truncated_file_raises_safe_error(tmp_path):
    studies = write_synthetic_rsna(tmp_path, SyntheticSpec(n_studies=1, corrupt={0: "truncated"}))
    study = next(iter(studies))
    adapter = RsnaAdapter(tmp_path)
    ref = adapter.select_series(study)["sagittal"]
    with pytest.raises(PreprocessingError) as err:
        adapter.load_series(study, ref.series_id)
    msg = str(err.value)
    assert "1 of 8" in msg and str(tmp_path) not in msg and study not in msg


def test_mixed_slice_sizes_raise(tmp_path):
    studies = write_synthetic_rsna(tmp_path, SyntheticSpec(n_studies=1, corrupt={0: "mixed_size"}))
    study = next(iter(studies))
    adapter = RsnaAdapter(tmp_path)
    ref = adapter.select_series(study)["coronal"]
    with pytest.raises(PreprocessingError, match="mixes image sizes"):
        adapter.load_series(study, ref.series_id)


def test_missing_positions_fall_back_to_instance_number_with_warning(tmp_path):
    import pydicom

    studies = write_synthetic_rsna(tmp_path, SyntheticSpec(n_studies=1, extra_sagittal_t1=False))
    study = next(iter(studies))
    adapter = RsnaAdapter(tmp_path)
    ref = adapter.select_series(study)["coronal"]
    for f in (tmp_path / "train_series" / study / ref.series_id).glob("*.dcm"):
        ds = pydicom.dcmread(f)
        del ds.ImagePositionPatient
        ds.save_as(f)
    vol = adapter.load_series(study, ref.series_id)
    assert vol.slice_order == "instance_number"
    assert any("InstanceNumber" in w for w in vol.warnings)


def test_orientation_is_recorded_and_plane_derivable():
    for plane, iop in ORIENTATION.items():
        assert plane_from_orientation(iop) == plane.lower()


def test_adapter_never_flips_pixels():
    src = (ROOT / "ml/kneescope_ml/adapters/rsna.py").read_text()
    for forbidden in ("np.flip", "fliplr", "flipud", "[::-1]", "rot90"):
        assert forbidden not in src
