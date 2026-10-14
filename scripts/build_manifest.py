"""Build the demo study manifest from evaluation partitions only (KS-DATA-10).

  python scripts/build_manifest.py --dataset rsna --root data/rsna \
      --split-file artifacts/splits/rsna-rsna4-seed2026.csv --n 4 \
      --out artifacts/manifest/studies.json

Rules: studies come only from the validation or test partition (never training); at least
one study with a missing plane is included when one exists; selection is deterministic
for a seed. Output validates as a list of contract StudyDetail records (origin "dataset").
A sidecar ``*.selection.json`` records each study's partition and selection reason.
The manifest contains study UIDs, so it stays in artifacts/ (git-ignored) unless the
data terms allow sharing. Final demo roles are chosen in KS-DEMO-01.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from pathlib import Path

from kneescope_contracts.models import Plane, StudyDetail
from kneescope_ml.adapters.rsna import RsnaAdapter
from kneescope_ml.config import load_preprocessing_config
from kneescope_ml.render import rendered_size

EVAL_PARTITIONS = {"validation", "test"}


def study_detail(adapter: RsnaAdapter, study_id: str, label: str, max_size: int) -> StudyDetail:
    import pydicom

    series = []
    for ref in adapter.list_series(study_id):
        first = sorted((adapter.series_dir / study_id / ref.series_id).glob("*.dcm"))[0]
        ds = pydicom.dcmread(first, stop_before_pixels=True)
        width, height = rendered_size(int(ds.Rows), int(ds.Columns), max_size)
        series.append(
            {
                "series_id": ref.series_id,
                "plane": ref.plane,
                "description": ref.description,
                "num_slices": ref.num_slices,
                "slice_order": "patient_position",
                "fluid_sensitive": ref.fluid_sensitive,
                "fat_suppressed": ref.fat_suppressed,
                "rendered_width": width,
                "rendered_height": height,
            }
        )
    present = [p for p in ("sagittal", "coronal", "axial") if any(s["plane"] == p for s in series)]
    return StudyDetail.model_validate(
        {
            "study_id": study_id,
            "display_label": label,
            "origin": "dataset",
            "dataset_id": adapter.dataset_id,
            "planes_available": present,
            "series_count": len(series),
            "analysis_status": "not_run",
            "series": series,
            "missing_planes": [p.value for p in Plane if p.value not in present],
            "warnings": [],
        }
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["rsna"], required=True)
    ap.add_argument("--root", type=Path, required=True)
    ap.add_argument("--split-file", type=Path, required=True)
    ap.add_argument("--n", type=int, default=4)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--out", type=Path, default=Path("artifacts/manifest/studies.json"))
    args = ap.parse_args()
    if not 3 <= args.n <= 5:
        ap.error("--n must be between 3 and 5 (PRD section 17.3)")

    with args.split_file.open(newline="", encoding="utf-8") as fh:
        partition = {r["study_id"]: r["partition"] for r in csv.DictReader(fh)}
    adapter = RsnaAdapter(args.root)
    candidates = sorted(s for s in adapter.list_studies() if partition.get(s) in EVAL_PARTITIONS)
    if len(candidates) < args.n:
        print(f"only {len(candidates)} evaluation-partition studies on disk; need {args.n}")
        return 1

    def missing_plane(s: str) -> bool:
        return len(adapter.select_series(s)) < 3

    rng = random.Random(args.seed)
    rng.shuffle(candidates)
    chosen, reasons = [], {}
    with_gap = next((s for s in candidates if missing_plane(s)), None)
    if with_gap:
        chosen.append(with_gap)
        reasons[with_gap] = "missing plane (error/limitation case candidate)"
    for s in candidates:
        if len(chosen) >= args.n:
            break
        if s not in chosen:
            chosen.append(s)
            reasons[s] = "complete study (seeded random pick from evaluation partitions)"

    cfg = load_preprocessing_config()
    details = [
        study_detail(adapter, s, f"Demo study {i + 1}", cfg.render_max_size) for i, s in enumerate(chosen)
    ]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"studies": [d.model_dump(mode="json") for d in details]}, indent=2) + "\n",
        encoding="utf-8",
    )
    selection = {
        "seed": args.seed,
        "split_file": str(args.split_file),
        "studies": [
            {
                "display_label": d.display_label,
                "partition": partition[d.study_id],
                "reason": reasons[d.study_id],
            }
            for d in details
        ],
    }
    args.out.with_suffix(".selection.json").write_text(
        json.dumps(selection, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"manifest: {len(details)} studies -> {args.out}"
        f"{'' if with_gap else ' (no missing-plane study available in evaluation partitions)'}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
