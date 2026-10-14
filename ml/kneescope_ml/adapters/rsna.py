"""Adapter for the RSNA Knee Abnormality Detection dataset layout (KS-DATA-05, KS-DATA-06).

Layout: ``train.csv``, ``train_series.csv`` and
``train_series/<StudyInstanceUID>/<SeriesInstanceUID>/<SOPInstanceUID>.dcm``.

Rules implemented here (contracts/README.md sections 2-3):

- **Slice order** is ``ImagePositionPatient`` projected on the slice normal
  (row x column of ``ImageOrientationPatient``). Never filename or SOPInstanceUID.
  ``InstanceNumber`` is used only if positions are missing, with ``slice_order =
  "instance_number"`` and a warning.
- **Plane** comes from ``Anatomical_Plane`` and is cross-checked against the normal's
  dominant LPS axis. A disagreement gives ``plane = None`` plus a warning; such series are
  listed but never selected for model input.
- **Series selection** (one per plane): prefer fluid-sensitive, then fat-suppressed, then
  more slices, then the lexicographically smallest SeriesInstanceUID (deterministic).
- **No flipping.** Orientation and laterality are recorded, pixels are left as acquired.
- **Errors** raise ``PreprocessingError`` with reviewer-safe messages (no paths, no UIDs).

This module never reads labels (tests/test_label_isolation.py).
"""

from __future__ import annotations

import csv
from functools import cached_property
from pathlib import Path

import numpy as np

from kneescope_ml.adapters.base import SeriesRef
from kneescope_ml.preprocess import PreprocessingError
from kneescope_ml.types import SeriesVolume

PLANE_NAMES = {"sagittal": "sagittal", "coronal": "coronal", "axial": "axial"}
# Dominant LPS axis of the slice normal -> plane.
AXIS_PLANE = {0: "sagittal", 1: "coronal", 2: "axial"}
ORIENTATION_TOLERANCE = 1e-3


def plane_from_orientation(iop: tuple[float, ...]) -> str:
    row, col = np.asarray(iop[:3], dtype=float), np.asarray(iop[3:6], dtype=float)
    normal = np.cross(row, col)
    return AXIS_PLANE[int(np.argmax(np.abs(normal)))]


def _flag(value: str | None) -> bool | None:
    if value is None or value.strip() == "":
        return None
    return value.strip() in {"1", "1.0", "True", "true"}


class RsnaAdapter:
    dataset_id = "rsna_knee_2026"

    def __init__(
        self, root: Path, series_dir: str = "train_series", series_csv: str = "train_series.csv"
    ) -> None:
        self.root = Path(root)
        self.series_dir = self.root / series_dir
        self.series_csv = self.root / series_csv

    @cached_property
    def _rows(self) -> dict[str, list[dict[str, str]]]:
        rows: dict[str, list[dict[str, str]]] = {}
        with self.series_csv.open(newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                rows.setdefault(row["StudyInstanceUID"], []).append(row)
        return rows

    def list_studies(self) -> list[str]:
        """Studies present in the series CSV *and* on disk (partial downloads are normal)."""
        return sorted(s for s in self._rows if (self.series_dir / s).is_dir())

    def _files(self, study_id: str, series_id: str) -> list[Path]:
        return sorted((self.series_dir / study_id / series_id).glob("*.dcm"))

    def list_series(self, study_id: str) -> list[SeriesRef]:
        refs = []
        for row in self._rows.get(study_id, []):
            series_id = row["SeriesInstanceUID"]
            n = len(self._files(study_id, series_id))
            if n == 0:
                continue
            plane = PLANE_NAMES.get(row.get("Anatomical_Plane", "").strip().lower())
            refs.append(
                SeriesRef(
                    study_id=study_id,
                    series_id=series_id,
                    plane=plane,
                    num_slices=n,
                    slice_order="patient_position",
                    description=None,
                    fluid_sensitive=_flag(row.get("Fluid_Sensitive")),
                    fat_suppressed=_flag(row.get("Fat_Suppression")),
                )
            )
        return refs

    def select_series(self, study_id: str) -> dict[str, SeriesRef]:
        """At most one series per plane for model input (rule in the module docstring)."""
        chosen: dict[str, SeriesRef] = {}
        for ref in sorted(self.list_series(study_id), key=_selection_key):
            if ref.plane and ref.plane not in chosen:
                chosen[ref.plane] = ref
        return chosen

    def load_series(self, study_id: str, series_id: str) -> SeriesVolume:
        import pydicom
        from pydicom.errors import InvalidDicomError

        files = self._files(study_id, series_id)
        if not files:
            raise PreprocessingError("Series has no image files.")
        slices = []
        unreadable = 0
        for path in files:
            try:
                ds = pydicom.dcmread(path)
                pixels = ds.pixel_array.astype(np.float32)
            except (InvalidDicomError, OSError, ValueError, AttributeError, EOFError, KeyError):
                unreadable += 1
                continue
            slope = float(getattr(ds, "RescaleSlope", 1) or 1)
            intercept = float(getattr(ds, "RescaleIntercept", 0) or 0)
            slices.append((ds, pixels * slope + intercept))
        if unreadable:
            raise PreprocessingError(
                f"Series could not be read: {unreadable} of {len(files)} image files are "
                "unreadable or corrupt."
            )
        shapes = {px.shape for _, px in slices}
        if len(shapes) != 1:
            raise PreprocessingError(
                "Series mixes image sizes "
                f"({', '.join(f'{r}x{c}' for r, c in sorted(shapes))}); no resampling rule is defined."
            )

        warnings: list[str] = []
        first = slices[0][0]
        iop = tuple(float(v) for v in getattr(first, "ImageOrientationPatient", []) or [])
        if len(iop) == 6:
            for ds, _ in slices:
                other = tuple(float(v) for v in getattr(ds, "ImageOrientationPatient", []) or [])
                if len(other) != 6 or np.max(np.abs(np.subtract(other, iop))) > ORIENTATION_TOLERANCE:
                    raise PreprocessingError("Series mixes slice orientations.")
        has_positions = len(iop) == 6 and all(
            len(getattr(ds, "ImagePositionPatient", []) or []) == 3 for ds, _ in slices
        )

        if has_positions:
            normal = np.cross(np.asarray(iop[:3]), np.asarray(iop[3:]))
            keys = [
                float(np.dot(np.asarray(ds.ImagePositionPatient, dtype=float), normal)) for ds, _ in slices
            ]
            if len(set(np.round(keys, 4))) != len(keys):
                warnings.append("Duplicate slice positions in series.")
            order, slice_order = np.argsort(keys, kind="mergesort"), "patient_position"
        else:
            keys = [float(getattr(ds, "InstanceNumber", 0) or 0) for ds, _ in slices]
            order, slice_order = np.argsort(keys, kind="mergesort"), "instance_number"
            warnings.append("Slice positions missing; ordered by InstanceNumber.")

        plane = self._csv_plane(study_id, series_id)
        if len(iop) == 6:
            geometric = plane_from_orientation(iop)
            if plane is not None and plane != geometric:
                warnings.append(f"Plane label '{plane}' disagrees with orientation ('{geometric}').")
                plane = None
        else:
            warnings.append("Orientation missing; plane taken from the series table.")

        spacing = getattr(first, "PixelSpacing", None)
        thickness = getattr(first, "SliceThickness", None)
        laterality = getattr(first, "ImageLaterality", None) or getattr(first, "Laterality", None)
        return SeriesVolume(
            study_id=study_id,
            series_id=series_id,
            plane=plane,
            pixels=np.stack([slices[i][1] for i in order]).astype(np.float32),
            slice_order=slice_order,
            pixel_spacing_mm=(float(spacing[0]), float(spacing[1])) if spacing else None,
            slice_thickness_mm=float(thickness) if thickness else None,
            description=str(getattr(first, "SeriesDescription", "")) or None,
            orientation=iop or None,
            laterality=str(laterality) if laterality else None,
            warnings=tuple(warnings),
        )

    def patient_id(self, study_id: str) -> str | None:
        """PatientID from the first readable header of the study (for grouped splits)."""
        import pydicom

        for ref in self.list_series(study_id):
            for path in self._files(study_id, ref.series_id)[:1]:
                try:
                    value = pydicom.dcmread(path, stop_before_pixels=True).get("PatientID")
                except Exception:
                    continue
                if value:
                    return str(value)
        return None

    def _csv_plane(self, study_id: str, series_id: str) -> str | None:
        for row in self._rows.get(study_id, []):
            if row["SeriesInstanceUID"] == series_id:
                return PLANE_NAMES.get(row.get("Anatomical_Plane", "").strip().lower())
        return None


def _selection_key(ref: SeriesRef) -> tuple[int, int, int, str]:
    return (
        0 if ref.fluid_sensitive else 1,
        0 if ref.fat_suppressed else 1,
        -ref.num_slices,
        ref.series_id,
    )
