"""Build the labels file from a dataset table.

Run this on your own machine. Never commit the output file.
Example:
    uv run python scripts/build_labels.py --profile rsna4 --input path/to/train.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from kneescope_ml.labels import (
    build_label_rows,
    column_map_for_profile,
    count_states,
    write_label_rows,
)

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, help="profile name in contracts/findings.json")
    parser.add_argument("--input", required=True, type=Path, help="dataset CSV, one row per study")
    parser.add_argument("--id-column", default="study_id", help="name of the study ID column")
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument("--source-ref", default=None)
    args = parser.parse_args()

    column_map = column_map_for_profile(ROOT / "contracts" / "findings.json", args.profile)
    with args.input.open(newline="", encoding="utf-8") as handle:
        table = list(csv.DictReader(handle))
    for row in table:
        row["study_id"] = row[args.id_column]

    rows = build_label_rows(
        table,
        column_map,
        source_ref=args.source_ref or args.input.name,
    )
    out = args.out or ROOT / "artifacts" / "labels" / f"{args.profile}.csv"
    write_label_rows(rows, out)

    print(f"wrote {out}")
    for finding_id, counts in count_states(rows).items():
        print(finding_id, dict(sorted(counts.items())))


if __name__ == "__main__":
    main()
