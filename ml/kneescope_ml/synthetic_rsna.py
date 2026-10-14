"""Synthetic datasets in the RSNA Knee Abnormality Detection file layout.

For tests and dry runs of the data pipeline before real data access exists. Volumes are
geometric test patterns, never anatomy, and every report says SYNTHETIC. Layout (from the
public Kaggle data page):

    <root>/train.csv          StudyInstanceUID, Report, 12 label columns (blank = unlabelled)
    <root>/train_series.csv   StudyInstanceUID, SeriesInstanceUID, Fluid_Sensitive,
                              Fat_Suppression, Anatomical_Plane
    <root>/train_series/<StudyInstanceUID>/<SeriesInstanceUID>/<SOPInstanceUID>.dcm

File names and InstanceNumber are deliberately shuffled relative to spatial position so
that anything ordering slices by name or InstanceNumber fails tests. Each slice encodes
its true spatial index in pixel value (``SLICE_CODE_BASE + 10 * index`` in a central
square) so ordering can be verified from pixels.
"""

from __future__ import annotations

import csv
import random
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from pydicom.uid import UID

RSNA_LABELS = (
    "ACL",
    "MCL",
    "Medial Meniscus",
    "Lateral Meniscus",
    "Medial OA",
    "Lateral OA",
    "PF OA",
    "Effusion",
    "Synovitis",
    "Baker's",
    "Contusion",
    "Fracture",
)
PLANES = ("Sagittal", "Coronal", "Axial")
SLICE_CODE_BASE = 100

# Row and column direction cosines (LPS) per plane, as acquired.
ORIENTATION = {
    "Sagittal": (0.0, 1.0, 0.0, 0.0, 0.0, -1.0),
    "Coronal": (1.0, 0.0, 0.0, 0.0, 0.0, -1.0),
    "Axial": (1.0, 0.0, 0.0, 0.0, 1.0, 0.0),
}

UID_ROOT = "1.2.826.0.1.3680043.10.1145."  # synthetic-only root; never used for real data


@dataclass
class SyntheticSpec:
    n_studies: int = 6
    slices: int = 8
    size: int = 32
    labelled_fraction: float = 0.67
    seed: int = 7
    patients: int | None = None  # if set, studies share PatientIDs (for grouping tests)
    missing_plane: dict[int, str] = field(default_factory=dict)  # study index -> plane
    extra_sagittal_t1: bool = True  # second sagittal series, not fluid-sensitive
    transfer_syntax: str = "explicit"  # explicit | implicit | rle | jpeg2000
    corrupt: dict[int, str] = field(default_factory=dict)  # study index -> kind
    unknown_rate: float = 0.15  # blank labels inside labelled studies


def _uid(rng: random.Random) -> UID:
    return UID(UID_ROOT + ".".join(str(rng.randint(1, 10**9)) for _ in range(3)))


def write_synthetic_rsna(root: Path, spec: SyntheticSpec | None = None) -> dict[str, list[str]]:
    """Write a synthetic RSNA-layout dataset. Returns {study_uid: [series_uid, ...]}."""
    import pydicom
    from pydicom.dataset import Dataset, FileMetaDataset
    from pydicom.uid import (
        ExplicitVRLittleEndian,
        ImplicitVRLittleEndian,
        JPEG2000Lossless,
        MRImageStorage,
        RLELossless,
    )

    spec = spec or SyntheticSpec()
    rng = random.Random(spec.seed)
    nrng = np.random.default_rng(spec.seed)
    root.mkdir(parents=True, exist_ok=True)
    (root / "train_series").mkdir(exist_ok=True)
    studies: dict[str, list[str]] = {}
    series_rows: list[dict[str, str]] = []
    label_rows: list[dict[str, str]] = []

    for s_idx in range(spec.n_studies):
        study_uid = _uid(rng)
        patient = f"SYNTH-P{(s_idx % spec.patients) if spec.patients else s_idx:03d}"
        studies[study_uid] = []
        planes = [p for p in PLANES if spec.missing_plane.get(s_idx) != p]
        series_defs = [(p, True, True) for p in planes]
        if spec.extra_sagittal_t1 and "Sagittal" in planes:
            series_defs.append(("Sagittal", False, False))
        for plane, fluid, fat in series_defs:
            series_uid = _uid(rng)
            studies[study_uid].append(series_uid)
            series_rows.append(
                {
                    "StudyInstanceUID": study_uid,
                    "SeriesInstanceUID": series_uid,
                    "Fluid_Sensitive": str(int(fluid)),
                    "Fat_Suppression": str(int(fat)),
                    "Anatomical_Plane": plane,
                }
            )
            sdir = root / "train_series" / study_uid / series_uid
            sdir.mkdir(parents=True, exist_ok=True)
            row, col = np.array(ORIENTATION[plane][:3]), np.array(ORIENTATION[plane][3:])
            normal = np.cross(row, col)
            instance_numbers = list(range(1, spec.slices + 1))
            rng.shuffle(instance_numbers)  # InstanceNumber does not follow position
            for k in range(spec.slices):
                pixels = (nrng.normal(400, 30, (spec.size, spec.size))).clip(0, 4000).astype(np.uint16)
                c = spec.size // 4
                pixels[c:-c, c:-c] = SLICE_CODE_BASE + 10 * k
                meta = FileMetaDataset()
                meta.MediaStorageSOPClassUID = MRImageStorage
                meta.MediaStorageSOPInstanceUID = _uid(rng)
                meta.TransferSyntaxUID = (
                    ImplicitVRLittleEndian if spec.transfer_syntax == "implicit" else ExplicitVRLittleEndian
                )
                ds = Dataset()
                ds.file_meta = meta
                ds.SOPClassUID = MRImageStorage
                ds.SOPInstanceUID = meta.MediaStorageSOPInstanceUID
                ds.StudyInstanceUID, ds.SeriesInstanceUID = study_uid, series_uid
                ds.PatientID = patient
                ds.Modality = "MR"
                ds.SeriesDescription = f"SYNTHETIC {plane} {'PD FS' if fluid else 'T1'}"
                ds.InstanceNumber = instance_numbers[k]
                ds.ImageOrientationPatient = list(ORIENTATION[plane])
                ds.ImagePositionPatient = [float(v) for v in (normal * 3.5 * k + row * -50 + col * -50)]
                ds.PixelSpacing = [0.5, 0.5]
                ds.SliceThickness = 3.0
                ds.Rows = ds.Columns = spec.size
                ds.SamplesPerPixel, ds.PhotometricInterpretation = 1, "MONOCHROME2"
                ds.BitsAllocated, ds.BitsStored, ds.HighBit, ds.PixelRepresentation = 16, 16, 15, 0
                ds.RescaleSlope, ds.RescaleIntercept = 1, 0
                ds.PixelData = pixels.tobytes()
                if spec.transfer_syntax == "rle":
                    ds.compress(RLELossless)
                elif spec.transfer_syntax == "jpeg2000":
                    ds.compress(JPEG2000Lossless)
                path = sdir / f"{meta.MediaStorageSOPInstanceUID}.dcm"  # name unrelated to order
                ds.save_as(path, enforce_file_format=True)
                if spec.corrupt.get(s_idx) == "truncated" and plane == "Sagittal" and fluid and k == 0:
                    path.write_bytes(path.read_bytes()[:200])
            if spec.corrupt.get(s_idx) == "mixed_size" and plane == "Coronal":
                extra = Dataset()
                extra.file_meta = FileMetaDataset()
                extra.file_meta.MediaStorageSOPClassUID = MRImageStorage
                extra.file_meta.MediaStorageSOPInstanceUID = _uid(rng)
                extra.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
                odd = pydicom.dcmread(next(sdir.glob("*.dcm")))
                for tag in (
                    "StudyInstanceUID",
                    "SeriesInstanceUID",
                    "PatientID",
                    "ImageOrientationPatient",
                    "PixelSpacing",
                    "SliceThickness",
                    "SamplesPerPixel",
                    "PhotometricInterpretation",
                    "BitsAllocated",
                    "BitsStored",
                    "HighBit",
                    "PixelRepresentation",
                ):
                    setattr(extra, tag, getattr(odd, tag))
                extra.SOPClassUID = MRImageStorage
                extra.SOPInstanceUID = extra.file_meta.MediaStorageSOPInstanceUID
                extra.Modality, extra.InstanceNumber = "MR", 99
                extra.ImagePositionPatient = [0.0, -50.0, -60.0]
                extra.Rows = extra.Columns = spec.size * 2
                extra.PixelData = np.zeros((spec.size * 2, spec.size * 2), np.uint16).tobytes()
                extra.save_as(sdir / f"{extra.SOPInstanceUID}.dcm", enforce_file_format=True)

        labelled = s_idx < round(spec.n_studies * spec.labelled_fraction)
        label_row = {"StudyInstanceUID": study_uid, "Report": "SYNTHETIC REPORT - NOT A REAL STUDY"}
        for i, name in enumerate(RSNA_LABELS):
            if not labelled or nrng.random() < spec.unknown_rate:
                label_row[name] = ""
            else:
                label_row[name] = str(int((s_idx + i) % 3 == 0))
        label_rows.append(label_row)

    with (root / "train_series.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(series_rows[0]))
        w.writeheader()
        w.writerows(series_rows)
    with (root / "train.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["StudyInstanceUID", "Report", *RSNA_LABELS])
        w.writeheader()
        w.writerows(label_rows)
    return studies
