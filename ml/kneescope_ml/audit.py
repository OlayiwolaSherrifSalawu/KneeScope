"""Dataset audit (KS-DATA-03): counts that decide the finding profile and the splits.

Output contains counts and field names only. It never includes study/series UIDs,
patient identifiers or report text, so it can be summarised in docs/data-audit.md.
Reads label *values* only to count them; it is not part of any inference path.
"""

from __future__ import annotations

import csv
import statistics
from collections import Counter
from pathlib import Path
from typing import Any

from kneescope_ml.adapters.rsna import RsnaAdapter

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
GROUPING_FIELDS = (
    "PatientID",
    "IssuerOfPatientID",
    "InstitutionName",
    "StationName",
    "Manufacturer",
    "ManufacturerModelName",
)


def _summary(values: list[int]) -> dict[str, float | int | None]:
    if not values:
        return {"n": 0, "min": None, "median": None, "max": None}
    return {"n": len(values), "min": min(values), "median": statistics.median(values), "max": max(values)}


def audit_rsna(
    root: Path,
    *,
    header_sample_per_series: int = 1,
    decode_sample_per_series: int = 1,
    limit: int | None = None,
) -> dict[str, Any]:
    """Audit an RSNA-layout directory. ``limit`` caps studies inspected on disk."""
    import pydicom

    adapter = RsnaAdapter(root)
    with (Path(root) / "train.csv").open(newline="", encoding="utf-8") as fh:
        label_rows = list(csv.DictReader(fh))

    labels: dict[str, Counter[str]] = {name: Counter() for name in RSNA_LABELS}
    labelled = 0
    for row in label_rows:
        values = [row.get(name, "").strip() for name in RSNA_LABELS]
        is_labelled = any(v != "" for v in values)
        labelled += is_labelled
        for name, v in zip(RSNA_LABELS, values, strict=True):
            if not is_labelled:
                labels[name]["not_labeled"] += 1
            elif v in {"1", "1.0"}:
                labels[name]["positive"] += 1
            elif v in {"0", "0.0"}:
                labels[name]["negative"] += 1
            else:
                labels[name]["unknown"] += 1

    studies = adapter.list_studies()
    if limit is not None:
        studies = studies[:limit]
    series_per_study, slices_per_series = [], []
    plane_studies: Counter[str] = Counter()
    no_plane = 0
    syntaxes: Counter[str] = Counter()
    unreadable_headers = undecodable = 0
    grouping: dict[str, set[str]] = {f: set() for f in GROUPING_FIELDS}
    patient_per_study: list[int] = []
    disk_bytes = 0

    for study in studies:
        refs = adapter.list_series(study)
        series_per_study.append(len(refs))
        planes = {r.plane for r in refs if r.plane}
        for p in planes:
            plane_studies[p] += 1
        no_plane += not planes
        study_patients: set[str] = set()
        for ref in refs:
            files = sorted((adapter.series_dir / study / ref.series_id).glob("*.dcm"))
            slices_per_series.append(len(files))
            disk_bytes += sum(f.stat().st_size for f in files)
            for i, f in enumerate(files[: max(header_sample_per_series, decode_sample_per_series)]):
                try:
                    ds = pydicom.dcmread(f, stop_before_pixels=i >= decode_sample_per_series)
                except Exception:
                    unreadable_headers += 1
                    continue
                ts = getattr(getattr(ds, "file_meta", None), "TransferSyntaxUID", None)
                syntaxes[ts.name if ts is not None else "unknown"] += 1
                for field in GROUPING_FIELDS:
                    value = getattr(ds, field, None)
                    if value not in (None, ""):
                        grouping[field].add(str(value))
                if getattr(ds, "PatientID", None):
                    study_patients.add(str(ds.PatientID))
                if i < decode_sample_per_series:
                    try:
                        _ = ds.pixel_array
                    except Exception:
                        undecodable += 1
        patient_per_study.append(len(study_patients))

    n_patients = len(grouping["PatientID"])
    return {
        "dataset": "rsna_knee_2026",
        "studies_in_train_csv": len(label_rows),
        "labelled_studies": labelled,
        "studies_on_disk_inspected": len(studies),
        "labels": {name: dict(counts) for name, counts in labels.items()},
        "series_per_study": _summary(series_per_study),
        "slices_per_series": _summary(slices_per_series),
        "studies_with_plane": {p: plane_studies.get(p, 0) for p in ("sagittal", "coronal", "axial")},
        "studies_with_no_known_plane": no_plane,
        "transfer_syntaxes_sampled": dict(syntaxes),
        "unreadable_files_sampled": unreadable_headers,
        "undecodable_files_sampled": undecodable,
        "grouping": {
            "fields_present": sorted(f for f, v in grouping.items() if v),
            "distinct_patient_ids": n_patients,
            "studies_per_patient_ratio": (len(studies) / n_patients) if n_patients else None,
            "studies_with_multiple_patient_ids": sum(n > 1 for n in patient_per_study),
            "distinct_values": {f: len(v) for f, v in grouping.items() if v},
        },
        "disk_bytes_inspected": disk_bytes,
        "sampling": {
            "header_files_per_series": header_sample_per_series,
            "decoded_files_per_series": decode_sample_per_series,
        },
    }


def markdown_tables(report: dict[str, Any], findings: tuple[str, ...] = RSNA_LABELS) -> str:
    """Tables for docs/data-audit.md sections 2-4 (counts only)."""
    lines = ["| Finding | Positive | Negative | Unknown | Not labelled |", "|---|---|---|---|---|"]
    for name in findings:
        c = report["labels"][name]
        lines.append(
            f"| {name} | {c.get('positive', 0)} | {c.get('negative', 0)} | "
            f"{c.get('unknown', 0)} | {c.get('not_labeled', 0)} |"
        )
    lines += ["", "| Plane | Studies with ≥1 series |", "|---|---|"]
    for plane, n in report["studies_with_plane"].items():
        lines.append(f"| {plane} | {n} |")
    s, sl = report["series_per_study"], report["slices_per_series"]
    lines += [
        "",
        f"Studies in train.csv: {report['studies_in_train_csv']}; labelled: "
        f"{report['labelled_studies']}; inspected on disk: {report['studies_on_disk_inspected']}.",
        f"Series per study: median {s['median']} (range {s['min']}–{s['max']}). "
        f"Slices per series: median {sl['median']} (range {sl['min']}–{sl['max']}).",
        f"Transfer syntaxes (sampled): {report['transfer_syntaxes_sampled']}. "
        f"Unreadable: {report['unreadable_files_sampled']}; undecodable: "
        f"{report['undecodable_files_sampled']}.",
        f"Grouping fields present: {report['grouping']['fields_present'] or 'none'}; "
        f"distinct PatientID: {report['grouping']['distinct_patient_ids']}.",
    ]
    return "\n".join(lines) + "\n"
