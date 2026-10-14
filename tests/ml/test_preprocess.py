import numpy as np
import pytest

from kneescope_ml.adapters.fixture import FixtureAdapter
from kneescope_ml.config import load_preprocessing_config
from kneescope_ml.preprocess import PreprocessingError, preprocess_study, sample_slice_indices
from kneescope_ml.types import SeriesVolume

CFG = load_preprocessing_config()


def test_sampling_is_ordered_without_repeats():
    idx = sample_slice_indices(100, 32)
    assert len(idx) == 32 and np.all(np.diff(idx) > 0)
    assert list(sample_slice_indices(10, 32)) == list(range(10))


def test_contract_shapes_masks_and_missing_plane():
    adapter = FixtureAdapter()
    refs = adapter.select_series("fx-study-004")  # coronal + axial only
    series = {p: adapter.load_series("fx-study-004", r.series_id) for p, r in refs.items()}
    out = preprocess_study("fx-study-004", series, CFG)
    assert set(out.planes) == {"sagittal", "coronal", "axial"}
    for plane in out.planes.values():
        assert plane.volume.dtype == np.float32
        assert plane.volume.shape == (CFG.num_slices, CFG.height, CFG.width)
        assert plane.mask.shape == (CFG.num_slices,)
    sag = out.planes["sagittal"]
    assert not sag.present and not sag.mask.any() and (sag.source_slice_index == -1).all()
    cor = out.planes["coronal"]
    assert cor.mask.sum() == 24 and (cor.source_slice_index[cor.mask] == np.arange(24)).all()
    assert "sagittal series missing" in out.warnings


def test_constant_and_invalid_series():
    flat = SeriesVolume("s", "x", "sagittal", np.ones((4, 8, 8), np.float32), "synthetic")
    out = preprocess_study("s", {"sagittal": flat}, CFG)
    assert np.allclose(out.planes["sagittal"].volume, 0)
    bad = SeriesVolume("s", "x", "sagittal", np.full((4, 8, 8), np.nan, np.float32), "synthetic")
    with pytest.raises(PreprocessingError):
        preprocess_study("s", {"sagittal": bad}, CFG)


def test_series_from_another_study_is_rejected():
    other = SeriesVolume("other", "x", "sagittal", np.ones((4, 8, 8), np.float32), "synthetic")
    with pytest.raises(PreprocessingError):
        preprocess_study("s", {"sagittal": other}, CFG)


def test_short_series_is_padded_and_masked_with_source_mapping():
    vol = np.stack([np.full((8, 8), float(k)) for k in range(5)]).astype(np.float32)
    series = SeriesVolume("s", "x", "sagittal", vol, "synthetic")
    pt = preprocess_study("s", {"sagittal": series}, CFG).planes["sagittal"]
    assert pt.mask.sum() == 5 and not pt.mask[5:].any()
    assert list(pt.source_slice_index[:5]) == [0, 1, 2, 3, 4]
    assert (pt.source_slice_index[5:] == -1).all()


def test_long_series_sampling_maps_back_to_ordered_source_slices():
    vol = np.stack([np.full((8, 8), float(k)) for k in range(100)]).astype(np.float32)
    series = SeriesVolume("s", "x", "coronal", vol, "synthetic")
    pt = preprocess_study("s", {"coronal": series}, CFG).planes["coronal"]
    src = pt.source_slice_index
    assert pt.mask.all() and len(set(src.tolist())) == CFG.num_slices
    means = [float(pt.volume[i].mean()) for i in range(CFG.num_slices)]
    assert means == sorted(means)  # sampled slices keep spatial order


def test_training_uses_the_shared_preprocessing_function():
    import ast
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    for rel in ("ml/kneescope_ml/train.py", "scripts/inspect_preprocessing.py"):
        tree = ast.parse((root / rel).read_text())
        imported = {
            (node.module, a.name)
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom)
            for a in node.names
        }
        assert ("kneescope_ml.preprocess", "preprocess_study") in imported, rel
