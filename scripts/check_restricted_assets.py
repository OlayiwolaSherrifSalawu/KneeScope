"""Fail if restricted or oversized assets are tracked or staged in git.

Blocks: medical image formats, model checkpoints, cached tensors, anything under data/ or
artifacts/, and files larger than MAX_BYTES — unless explicitly allow-listed below with a
reason. See docs/security.md and AGENTS.md section 15.

Usage:
  python scripts/check_restricted_assets.py            # check the repository index
  python scripts/check_restricted_assets.py --root DIR # check another git work tree
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path, PurePosixPath

MAX_BYTES = 5 * 1024 * 1024
BLOCKED_SUFFIXES = {
    ".dcm",
    ".dicom",
    ".nii",
    ".nrrd",
    ".mha",
    ".mhd",  # imaging
    ".npz",
    ".npy",
    ".h5",
    ".hdf5",
    ".parquet",  # cached tensors / tables
    ".pt",
    ".pth",
    ".ckpt",
    ".safetensors",
    ".onnx",
    ".pkl",
    ".joblib",  # checkpoints
}
BLOCKED_DIRS = {"data", "artifacts"}
ALLOWED_PLACEHOLDERS = {".gitkeep"}
# path -> reason. Keep this list short and justified.
ALLOW_LARGE = {
    "knee-scope-complete-project-plan.pdf": "Authoritative project plan (design input, no patient data).",
}


def tracked_files(root: Path) -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", "--cached", "-z"], cwd=root, capture_output=True, check=True
    ).stdout.decode()
    return [p for p in out.split("\0") if p]


def violations(root: Path, paths: list[str]) -> list[str]:
    problems: list[str] = []
    for rel in paths:
        pure = PurePosixPath(rel)
        if pure.name in ALLOWED_PLACEHOLDERS:
            continue
        if pure.parts and pure.parts[0] in BLOCKED_DIRS:
            problems.append(f"{rel}: files under {pure.parts[0]}/ must never be committed")
            continue
        suffixes = {s.lower() for s in pure.suffixes}
        if suffixes & BLOCKED_SUFFIXES or rel.lower().endswith(".nii.gz"):
            problems.append(f"{rel}: restricted file type ({''.join(pure.suffixes)})")
            continue
        path = root / rel
        if path.is_file() and path.stat().st_size > MAX_BYTES and rel not in ALLOW_LARGE:
            size_mb = path.stat().st_size / 1024 / 1024
            problems.append(f"{rel}: {size_mb:.1f} MB exceeds {MAX_BYTES // 1024 // 1024} MB")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    problems = violations(args.root, tracked_files(args.root))
    for p in problems:
        print(f"BLOCKED {p}")
    print(f"restricted assets: {'FAIL' if problems else 'ok'}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
