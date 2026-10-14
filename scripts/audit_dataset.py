"""Audit a dataset directory and write a counts-only JSON report (KS-DATA-03).

  uv sync --extra ml
  python scripts/audit_dataset.py --dataset rsna --root data/rsna \
      --out artifacts/audit/rsna.json --markdown

The report contains counts and field names only (no UIDs, patient IDs or report text).
Paste the --markdown tables into docs/data-audit.md sections 2-4.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from kneescope_ml.audit import audit_rsna, markdown_tables


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["rsna"], required=True)
    ap.add_argument("--root", type=Path, required=True, help="Dataset root (outside git)")
    ap.add_argument("--out", type=Path, required=True, help="e.g. artifacts/audit/rsna.json")
    ap.add_argument("--limit", type=int, default=None, help="Inspect at most N studies on disk")
    ap.add_argument("--headers-per-series", type=int, default=1)
    ap.add_argument("--decode-per-series", type=int, default=1)
    ap.add_argument("--markdown", action="store_true", help="Also print tables for docs")
    args = ap.parse_args()

    report = audit_rsna(
        args.root,
        header_sample_per_series=args.headers_per_series,
        decode_sample_per_series=args.decode_per_series,
        limit=args.limit,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"audit written to {args.out} ({report['studies_on_disk_inspected']} studies inspected)")
    if args.markdown:
        print(markdown_tables(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
