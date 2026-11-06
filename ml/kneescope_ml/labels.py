"""Dataset label access for evaluation and the "Reveal dataset label" view only.

Labels are never an inference input. Do not import this module from
``kneescope_ml.inference``, ``kneescope_ml.preprocess`` or the API prediction path.
"""

from __future__ import annotations

import json
from pathlib import Path

LABEL_STATES = ("positive", "negative", "unknown", "not_labeled")


def load_fixture_labels(path: Path) -> dict[str, dict[str, dict[str, str | None]]]:
    """Return {study_id: {finding_id: {state, provenance, source_ref}}} from a fixture."""
    data = json.loads(path.read_text(encoding="utf-8"))
    for study in data["studies"].values():
        for label in study.values():
            if label["state"] not in LABEL_STATES:
                raise ValueError(f"invalid label state {label['state']!r}")
    return data["studies"]  # type: ignore[no-any-return]


def state_from_dataset_value(value: object) -> str:
    """Map a raw dataset cell to a label state.

    Blank or uncertain values become 'unknown', never 'negative'.
    'not_labeled' is decided per study in the build script, not here.
    """
    if value is None:
        return "unknown"
    if isinstance(value, float) and value != value:  # NaN
        return "unknown"
    text = str(value).strip().lower()
    if text in ("", "nan", "none", "unknown", "uncertain"):
        return "unknown"
    if text in ("1", "1.0"):
        return "positive"
    if text in ("0", "0.0"):
        return "negative"
    raise ValueError(f"unrecognised dataset label value {value!r}")


def column_map_for_profile(findings_path: Path, profile: str) -> dict[str, str]:
    """Return {finding_id: dataset column name} for a profile in findings.json."""
    data = json.loads(findings_path.read_text(encoding="utf-8"))
    chosen = data["profiles"][profile]
    dataset_id = chosen["dataset_id"]
    if dataset_id is None:
        raise ValueError(f"profile {profile!r} has no dataset")
    return {
        finding_id: data["findings"][finding_id]["dataset_columns"][dataset_id]
        for finding_id in chosen["findings"]
    }


def build_label_rows(
    rows: list[dict[str, object]],
    column_map: dict[str, str],
    provenance: str = "dataset_provided",
    source_ref: str | None = None,
    all_study_ids: list[str] | None = None,
) -> list[dict[str, str | None]]:
    """Turn one-row-per-study into one-row-per-study-and-finding.

    Blank or uncertain cells become 'unknown'. Studies listed in all_study_ids
    but absent from rows become 'not_labeled' for every finding.
    """
    out: list[dict[str, str | None]] = []
    seen: set[str] = set()
    for row in rows:
        study_id = str(row["study_id"])
        if study_id in seen:
            raise ValueError(f"duplicate study_id {study_id!r}")
        seen.add(study_id)
        for finding_id, column in column_map.items():
            if column not in row:
                raise ValueError(f"missing column {column!r} for study {study_id!r}")
            out.append(
                {
                    "study_id": study_id,
                    "finding_id": finding_id,
                    "state": state_from_dataset_value(row[column]),
                    "provenance": provenance,
                    "source_ref": source_ref,
                }
            )
    for study_id in all_study_ids or []:
        if str(study_id) in seen:
            continue
        for finding_id in column_map:
            out.append(
                {
                    "study_id": str(study_id),
                    "finding_id": finding_id,
                    "state": "not_labeled",
                    "provenance": provenance,
                    "source_ref": source_ref,
                }
            )
    return out
