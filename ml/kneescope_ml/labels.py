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
