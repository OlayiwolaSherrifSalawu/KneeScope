"""Build the preprocessed tensor cache for a split partition (KS-DATA-09).

  python scripts/cache_tensors.py --dataset rsna --root data/rsna \
      --split-file artifacts/splits/rsna-rsna4-seed2026.csv --partition train
  python scripts/cache_tensors.py --dataset fixture          # all fixture studies

Resumable: valid entries are skipped; stale entries (other preprocessing version/config)
are rebuilt. Failures are reported by index (no UIDs) and do not stop the run.
Output: artifacts/cache/<preprocessing version>/ (git-ignored).
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

from kneescope_ml.config import load_preprocessing_config
from kneescope_ml.data import StaleCacheError, cache_path, load_cached, write_cached
from kneescope_ml.preprocess import PreprocessingError, preprocess_study


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["fixture", "rsna"], required=True)
    ap.add_argument("--root", type=Path, default=None)
    ap.add_argument("--split-file", type=Path, default=None, help="study_id,partition CSV")
    ap.add_argument("--partition", choices=["train", "validation", "test"], default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--out", type=Path, default=Path("artifacts/cache"))
    args = ap.parse_args()

    if args.dataset == "rsna":
        if args.root is None:
            ap.error("--root is required for --dataset rsna")
        from kneescope_ml.adapters.rsna import RsnaAdapter

        adapter = RsnaAdapter(args.root)
    else:
        from kneescope_ml.adapters.fixture import FixtureAdapter

        adapter = FixtureAdapter()  # type: ignore[assignment]

    studies = adapter.list_studies()
    if args.split_file:
        with args.split_file.open(newline="", encoding="utf-8") as fh:
            wanted = {
                r["study_id"]
                for r in csv.DictReader(fh)
                if args.partition is None or r["partition"] == args.partition
            }
        studies = [s for s in studies if s in wanted]
    if args.limit is not None:
        studies = studies[: args.limit]

    cfg = load_preprocessing_config()
    built = skipped = failed = 0
    start = time.monotonic()
    for idx, study_id in enumerate(studies):
        path = cache_path(args.out, study_id, cfg)
        if path.exists():
            try:
                load_cached(path, cfg)
                skipped += 1
                continue
            except (StaleCacheError, OSError, ValueError, KeyError):
                path.unlink()  # stale or damaged entry: rebuild it
        try:
            refs = adapter.select_series(study_id)
            series = {p: adapter.load_series(study_id, r.series_id) for p, r in refs.items()}
            write_cached(preprocess_study(study_id, series, cfg), args.out, cfg)
            built += 1
        except PreprocessingError as exc:
            failed += 1
            print(f"study #{idx}: skipped — {exc}")
    elapsed = max(time.monotonic() - start, 1e-9)
    print(
        f"cache {cfg.version}: {built} built, {skipped} already valid, {failed} failed "
        f"in {elapsed:.1f}s ({built / elapsed:.2f} studies/s) -> {args.out / cfg.version}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
