"""In-memory data passed between adapters, preprocessing and models.

See contracts/README.md "Model input and output" for the normative description.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.float32]
BoolArray = npt.NDArray[np.bool_]
IntArray = npt.NDArray[np.int64]


@dataclass(frozen=True)
class SeriesVolume:
    """One acquisition as loaded by a dataset adapter, before preprocessing.

    ``pixels`` is (n_slices, rows, cols) in the series' contract slice order
    (slice_index 0..n-1). Intensities are raw stored values (after rescale slope /
    intercept where the format defines them). No flipping has been applied.
    """

    study_id: str
    series_id: str
    plane: str | None
    pixels: FloatArray
    slice_order: str
    pixel_spacing_mm: tuple[float, float] | None = None
    slice_thickness_mm: float | None = None
    description: str | None = None
    # Row/column direction cosines (DICOM ImageOrientationPatient, LPS) as acquired.
    orientation: tuple[float, ...] | None = None
    # Laterality if the dataset kept it (L/R); recorded, never used to flip images.
    laterality: str | None = None
    # Reviewer-safe notes from loading (e.g. ordering fallback, plane mismatch).
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class PlaneTensor:
    """Model input for one plane: ``volume`` float32 (S, H, W) and ``mask`` bool (S,).

    ``source_slice_index[i]`` is the original series slice_index that produced
    ``volume[i]`` (-1 for padding). Explanations map back through it.
    """

    plane: str
    series_id: str | None
    volume: FloatArray
    mask: BoolArray
    source_slice_index: IntArray
    present: bool


@dataclass(frozen=True)
class PreprocessedStudy:
    study_id: str
    preprocessing_version: str
    planes: dict[str, PlaneTensor]
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ModelOutput:
    """Raw model output. ``scores`` are sigmoid outputs keyed by finding_id.

    ``slice_attention`` is optional, keyed by plane, shape (S,), aligned with the
    PlaneTensor of the same plane.
    """

    scores: dict[str, float]
    slice_attention: dict[str, FloatArray] = field(default_factory=dict)
