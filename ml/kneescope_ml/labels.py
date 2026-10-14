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


def read_rsna_label_states(train_csv: Path, column_by_finding: dict[str, str]) -> dict[str, dict[str, str]]:
    """Dataset-provided RSNA labels as contract states: {study_id: {finding_id: state}}.

    ``column_by_finding`` maps finding IDs to train.csv columns (contracts/findings.json
    ``dataset_columns``). A study with every label blank is ``not_labeled``; a blank value
    in a labelled study is ``unknown``. Never treated as negative.
    """
    import csv

    states: dict[str, dict[str, str]] = {}
    with train_csv.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            values = {f: (row.get(col) or "").strip() for f, col in column_by_finding.items()}
            all_cols = [v for k, v in row.items() if k not in ("StudyInstanceUID", "Report")]
            labelled = any((v or "").strip() for v in all_cols)
            states[row["StudyInstanceUID"]] = {
                f: (
                    "not_labeled"
                    if not labelled
                    else "positive"
                    if v in {"1", "1.0"}
                    else "negative"
                    if v in {"0", "0.0"}
                    else "unknown"
                )
                for f, v in values.items()
            }
    return states
