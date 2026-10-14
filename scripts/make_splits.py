"""Create deterministic, grouped train/validation/test splits (KS-DATA-08).

  python scripts/make_splits.py --dataset rsna --root data/rsna --profile rsna4 --seed 2026
  python scripts/make_splits.py ... --expect-hash <sha256>    # verify a teammate's split

Writes artifacts/splits/<dataset>-<profile>-seed<seed>.csv (study_id, partition, group
hash) and a counts JSON beside it; both git-ignored. Prints the split hash and a counts
table for docs/data-audit.md section 5. Patient IDs are never written, only salted hashes.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from pathlib import Path

from kneescope_contracts.findings import load_profile
from kneescope_ml.adapters.rsna import RsnaAdapter
from kneescope_ml.labels import read_rsna_label_states
from kneescope_ml.splits import PARTITIONS, check_no_leakage, make_splits, partition_counts, split_hash

REGISTRY = Path(__file__).resolve().parents[1] / "contracts" / "findings.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["rsna"], required=True)
    ap.add_argument("--root", type=Path, required=True)
    ap.add_argument("--profile", default="rsna4")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--fractions", default="0.7,0.15,0.15", help="train,validation,test")
    ap.add_argument("--group-by", choices=["patient", "study"], default="patient")
    ap.add_argument(
        "--include-unlabelled",
        action="store_true",
        help="Add unlabelled studies (training only; they follow their patient's partition)",
    )
    ap.add_argument("--out-dir", type=Path, default=Path("artifacts/splits"))
    ap.add_argument("--expect-hash", default=None)
    args = ap.parse_args()

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    profile = load_profile(args.profile)
    findings = [f.finding_id for f in profile.findings]
    columns = {f: registry["findings"][f]["dataset_columns"]["rsna_knee_2026"] for f in findings}
    labels = read_rsna_label_states(args.root / "train.csv", columns)
    adapter = RsnaAdapter(args.root)
    on_disk = set(adapter.list_studies())
    labelled = sorted(
        s for s in on_disk if s in labels and any(v != "not_labeled" for v in labels[s].values())
    )
    unlabelled = sorted(on_disk - set(labelled))

    def group_of(study: str) -> str:
        if args.group_by == "study":
            return study
        pid = adapter.patient_id(study)
        return f"patient:{pid}" if pid else f"study:{study}"

    groups = {s: group_of(s) for s in labelled}
    fractions = tuple(float(x) for x in args.fractions.split(","))
    result = make_splits(
        groups,
        labels,
        findings,
        seed=args.seed,
        fractions=fractions,  # type: ignore[arg-type]
        grouping=args.group_by,
    )
    assignment = dict(result.assignment)
    if args.include_unlabelled:
        by_group = {groups[s]: p for s, p in assignment.items()}
        for s in unlabelled:
            g = group_of(s)
            groups[s] = g
            assignment[s] = by_group.get(g, "train")  # unlabelled never enter val/test alone
        check_no_leakage(assignment, groups)
    digest = split_hash(assignment)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{args.dataset}-{args.profile}-seed{args.seed}"
    salt = f"{args.dataset}:{args.seed}"
    with (args.out_dir / f"{stem}.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["study_id", "partition", "group_hash"])
        for s in sorted(assignment):
            gh = hashlib.sha256(f"{salt}:{groups[s]}".encode()).hexdigest()[:16]
            w.writerow([s, assignment[s], gh])
    counts = partition_counts(assignment, labels, findings)
    meta = {
        "split_hash": digest,
        "seed": args.seed,
        "grouping": args.group_by,
        "fractions": fractions,
        "profile": args.profile,
        "counts": counts,
        "labelled_studies": len(labelled),
        "unlabelled_included": args.include_unlabelled,
    }
    (args.out_dir / f"{stem}.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    print(f"split hash {digest}")
    print("| Partition | Studies | " + " | ".join(f"{f} n+/n-/unk" for f in findings) + " |")
    print("|---|---|" + "---|" * len(findings))
    for part in PARTITIONS:
        row = counts[part]
        n = row[findings[0]]["studies"] if findings else 0
        cells = " | ".join(f"{row[f]['positive']}/{row[f]['negative']}/{row[f]['unknown']}" for f in findings)
        print(f"| {part} | {n} | {cells} |")
    if args.expect_hash and args.expect_hash != digest:
        print(f"HASH MISMATCH: expected {args.expect_hash}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
