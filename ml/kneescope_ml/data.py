"""Preprocessed tensor cache and dataset for training/evaluation (KS-DATA-09).

Cache entries live under ``artifacts/cache/<preprocessing version>/`` (git-ignored), one
``.npz`` per study, keyed by study ID + preprocessing version + config SHA-256. Loading an
entry written with a different version or config raises ``StaleCacheError`` — a stale
cache is never silently used.

``CachedStudyDataset`` works with ``torch.utils.data.DataLoader`` (duck-typed: ``__len__``
and ``__getitem__``) but does not import torch, so data tooling runs without it. Labels are
an evaluation/training target only; this module is not imported by inference.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from pathlib import Path

import numpy as np

from kneescope_ml.config import PreprocessingConfig
from kneescope_ml.types import PlaneTensor, PreprocessedStudy


class StaleCacheError(ValueError):
    """Cache entry does not match the current preprocessing version/config."""


def cache_path(cache_root: Path, study_id: str, cfg: PreprocessingConfig) -> Path:
    digest = hashlib.sha256(f"{study_id}|{cfg.version}|{cfg.sha256}".encode()).hexdigest()[:24]
    return cache_root / cfg.version / f"{digest}.npz"


def write_cached(study: PreprocessedStudy, cache_root: Path, cfg: PreprocessingConfig) -> Path:
    if study.preprocessing_version != cfg.version:
        raise StaleCacheError("study was preprocessed with a different version")
    path = cache_path(cache_root, study.study_id, cfg)
    path.parent.mkdir(parents=True, exist_ok=True)
    arrays: dict[str, np.ndarray] = {}
    for plane, pt in study.planes.items():
        arrays[f"{plane}__volume"] = pt.volume
        arrays[f"{plane}__mask"] = pt.mask
        arrays[f"{plane}__source"] = pt.source_slice_index
    meta = {
        "study_id": study.study_id,
        "preprocessing_version": cfg.version,
        "config_sha256": cfg.sha256,
        "planes": {p: {"series_id": pt.series_id, "present": pt.present} for p, pt in study.planes.items()},
        "warnings": study.warnings,
    }
    tmp = path.with_suffix(".tmp.npz")
    np.savez_compressed(tmp, __meta__=np.array(json.dumps(meta)), **arrays)  # type: ignore[arg-type]
    tmp.replace(path)  # atomic: an interrupted write never leaves a valid-looking entry
    return path


def load_cached(path: Path, cfg: PreprocessingConfig) -> PreprocessedStudy:
    with np.load(path, allow_pickle=False) as data:
        meta = json.loads(str(data["__meta__"]))
        if meta["preprocessing_version"] != cfg.version or meta["config_sha256"] != cfg.sha256:
            raise StaleCacheError(
                f"cache entry built with {meta['preprocessing_version']} "
                f"(config {meta['config_sha256'][:8]}), current is {cfg.version} ({cfg.sha256[:8]})"
            )
        planes = {}
        for plane, info in meta["planes"].items():
            volume = data[f"{plane}__volume"]
            if volume.dtype != np.float32 or volume.shape != (cfg.num_slices, cfg.height, cfg.width):
                raise StaleCacheError(f"{plane} tensor has shape {volume.shape} {volume.dtype}")
            planes[plane] = PlaneTensor(
                plane=plane,
                series_id=info["series_id"],
                volume=volume,
                mask=data[f"{plane}__mask"],
                source_slice_index=data[f"{plane}__source"],
                present=bool(info["present"]),
            )
    return PreprocessedStudy(
        study_id=meta["study_id"],
        preprocessing_version=meta["preprocessing_version"],
        planes=planes,
        warnings=list(meta["warnings"]),
    )


def label_vector(states: Mapping[str, str], findings: Sequence[str]) -> tuple[np.ndarray, np.ndarray]:
    """(labels float32 0/1, known mask bool). Unknown/not_labeled -> mask False, never 0."""
    labels = np.array([1.0 if states.get(f) == "positive" else 0.0 for f in findings], dtype=np.float32)
    known = np.array([states.get(f) in ("positive", "negative") for f in findings], dtype=np.bool_)
    return labels, known


class CachedStudyDataset:
    """Studies of one partition from the tensor cache, with label targets and masks."""

    def __init__(
        self,
        study_ids: Sequence[str],
        labels: Mapping[str, Mapping[str, str]],
        findings: Sequence[str],
        cache_root: Path,
        cfg: PreprocessingConfig,
    ) -> None:
        self.cfg, self.cache_root, self.findings = cfg, cache_root, list(findings)
        self.labels = labels
        missing = [s for s in study_ids if not cache_path(cache_root, s, cfg).exists()]
        if missing:
            raise FileNotFoundError(f"{len(missing)} studies are not cached; run scripts/cache_tensors.py")
        self.study_ids = list(study_ids)

    def __len__(self) -> int:
        return len(self.study_ids)

    def __getitem__(self, i: int) -> tuple[PreprocessedStudy, np.ndarray, np.ndarray]:
        sid = self.study_ids[i]
        study = load_cached(cache_path(self.cache_root, sid, self.cfg), self.cfg)
        y, known = label_vector(self.labels.get(sid, {}), self.findings)
        return study, y, known
