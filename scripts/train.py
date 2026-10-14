"""Train a KneeScope model and record run provenance.

  uv sync --extra ml
  python scripts/train.py --config config/train.toml            # synthetic smoke run
  python scripts/train.py --config config/train.toml --log      # also append to docs/experiments.md

Runs are written to artifacts/runs/<run_id>/ (git-ignored).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from kneescope_ml.config import REPO_ROOT, load_preprocessing_config
from kneescope_ml.train import TrainConfig, synthetic_examples, train


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", type=Path, default=REPO_ROOT / "config/train.toml")
    ap.add_argument("--out", type=Path, default=REPO_ROOT / "artifacts/runs")
    ap.add_argument("--run-id", default=None)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--log", action="store_true", help="Append a row to docs/experiments.md")
    args = ap.parse_args()

    cfg = TrainConfig.load(args.config)
    prep = load_preprocessing_config()
    if cfg.data_source == "synthetic_smoke":
        examples = synthetic_examples(cfg, prep)
    else:
        print(
            "data.source 'cache': the tensor cache exists (scripts/cache_tensors.py); "
            "wiring it into training is KS-MODEL-03."
        )
        return 2
    run_dir = train(cfg, examples, args.out, prep=prep, run_id=args.run_id, resume=args.resume)
    meta = json.loads((run_dir / "metadata.json").read_text())
    print(f"run {meta['run_id']}: {meta['steps_completed']} steps, final loss {meta['final_loss']:.4f}")
    print(f"checkpoint sha256 {meta['checkpoint_sha256']}")
    if args.log:
        row = (
            f"| {meta['run_id']} | {meta['data_source']} | {meta['git_sha'][:10]}"
            f"{'+dirty' if meta['git_dirty'] else ''} | {meta['seed']} | {meta['split_hash']} | "
            f"{meta['preprocessing_version']} | {meta['checkpoint_sha256'][:12]} | "
            f"{meta['hardware']} | {meta['data_note']} |\n"
        )
        with (REPO_ROOT / "docs/experiments.md").open("a", encoding="utf-8") as fh:
            fh.write(row)
    return 0


if __name__ == "__main__":
    sys.exit(main())
