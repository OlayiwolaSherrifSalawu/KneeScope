"""Training loop with seeding, checkpointing and run provenance (KS-MODEL-02).

Every run writes ``<out_dir>/<run_id>/``:
  config.toml        the exact training config used
  metadata.json      provenance (see RUN_METADATA_KEYS and docs/experiments.md)
  checkpoint.pt      model + optimizer state (git-ignored, never committed)
  history.jsonl      one line per step: step, loss
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import os
import platform
import random
import subprocess
import tomllib
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import torch

from kneescope_contracts.findings import load_profile
from kneescope_ml.config import REPO_ROOT, PreprocessingConfig, load_preprocessing_config
from kneescope_ml.model import ModelSpec, StudyModel, masked_bce
from kneescope_ml.types import PreprocessedStudy

RUN_METADATA_KEYS = (
    "run_id",
    "created_at",
    "git_sha",
    "git_dirty",
    "seed",
    "data_source",
    "data_note",
    "split_hash",
    "finding_profile",
    "findings",
    "planes",
    "preprocessing_version",
    "preprocessing_sha256",
    "model_spec",
    "steps_completed",
    "final_loss",
    "checkpoint_sha256",
    "torch_version",
    "hardware",
)
SYNTHETIC_NOTE = "SYNTHETIC SMOKE DATA - fixture phantoms with random labels; metrics are meaningless."


@dataclass(frozen=True)
class TrainingExample:
    study: PreprocessedStudy
    labels: np.ndarray  # float32 (F,) 0/1; value ignored where mask is 0
    label_mask: np.ndarray  # bool (F,) True where the label is known


@dataclass(frozen=True)
class TrainConfig:
    raw: dict[str, Any]
    seed: int
    steps: int
    batch_size: int
    lr: float
    weight_decay: float
    checkpoint_every: int
    spec_kwargs: dict[str, Any]
    data_source: str
    finding_profile: str

    @classmethod
    def load(cls, path: Path) -> TrainConfig:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
        run, model, data = raw["run"], raw["model"], raw["data"]
        return cls(
            raw=raw,
            seed=int(run["seed"]),
            steps=int(run["steps"]),
            batch_size=int(run["batch_size"]),
            lr=float(run["lr"]),
            weight_decay=float(run["weight_decay"]),
            checkpoint_every=int(run["checkpoint_every"]),
            spec_kwargs=dict(model),
            data_source=str(data["source"]),
            finding_profile=str(data["finding_profile"]),
        )


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    torch.use_deterministic_algorithms(True, warn_only=True)


def collate(batch: Sequence[TrainingExample], planes: Sequence[str]) -> dict[str, torch.Tensor]:
    volumes = np.stack([np.stack([ex.study.planes[p].volume for p in planes]) for ex in batch])
    slice_mask = np.stack([np.stack([ex.study.planes[p].mask for p in planes]) for ex in batch])
    present = np.array([[ex.study.planes[p].present for p in planes] for ex in batch])
    return {
        "volumes": torch.from_numpy(volumes),
        "slice_mask": torch.from_numpy(slice_mask),
        "plane_present": torch.from_numpy(present),
        "labels": torch.from_numpy(np.stack([ex.labels for ex in batch]).astype(np.float32)),
        "label_mask": torch.from_numpy(np.stack([ex.label_mask for ex in batch])),
    }


def synthetic_examples(cfg: TrainConfig, prep: PreprocessingConfig) -> list[TrainingExample]:
    """Fixture phantoms through the shared preprocessing, with seeded random labels."""
    from kneescope_ml.adapters.fixture import FixtureAdapter
    from kneescope_ml.preprocess import preprocess_study

    smoke = cfg.raw["smoke"]
    small = dataclasses.replace(
        prep, num_slices=int(smoke["num_slices"]), height=int(smoke["size"]), width=int(smoke["size"])
    )
    adapter = FixtureAdapter()
    rng = np.random.default_rng(cfg.seed)
    n_findings = len(load_profile(cfg.finding_profile).findings)
    studies = adapter.list_studies()
    examples = []
    for i in range(int(smoke["n_studies"])):
        sid = studies[i % len(studies)]
        series = {p: adapter.load_series(sid, r.series_id) for p, r in adapter.select_series(sid).items()}
        study = preprocess_study(sid, series, small)
        labels = rng.integers(0, 2, n_findings).astype(np.float32)
        mask = rng.random(n_findings) >= float(smoke["unknown_label_rate"])
        examples.append(TrainingExample(study, labels, mask))
    return examples


def _git() -> tuple[str, bool]:
    try:
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = bool(
            subprocess.run(
                ["git", "status", "--porcelain"], cwd=REPO_ROOT, capture_output=True, text=True, check=True
            ).stdout.strip()
        )
        return sha, dirty
    except (OSError, subprocess.CalledProcessError):
        return "unknown", True


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def train(
    cfg: TrainConfig,
    examples: Sequence[TrainingExample],
    out_dir: Path,
    *,
    prep: PreprocessingConfig | None = None,
    split_hash: str = "synthetic",
    data_note: str = SYNTHETIC_NOTE,
    run_id: str | None = None,
    resume: bool = False,
) -> Path:
    """Train and return the run directory. Resumes from checkpoint.pt when ``resume``."""
    prep = prep or load_preprocessing_config()
    profile = load_profile(cfg.finding_profile)
    findings = tuple(f.finding_id for f in profile.findings)
    planes = tuple(prep.planes)
    spec = ModelSpec(findings=findings, planes=planes, **cfg.spec_kwargs)
    run_id = run_id or datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ") + f"-s{cfg.seed}"
    run_dir = out_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "config.toml").write_text(_toml(cfg.raw), encoding="utf-8")

    seed_everything(cfg.seed)
    model = StudyModel(spec)
    optim = torch.optim.AdamW(
        [p for p in model.parameters() if p.requires_grad], lr=cfg.lr, weight_decay=cfg.weight_decay
    )
    step = 0
    ckpt_path = run_dir / "checkpoint.pt"
    if resume and ckpt_path.exists():
        state = torch.load(ckpt_path, weights_only=False)
        model.load_state_dict(state["model"])
        optim.load_state_dict(state["optimizer"])
        step = int(state["step"])

    gen = torch.Generator().manual_seed(cfg.seed)
    loss_value = float("nan")
    with (run_dir / "history.jsonl").open("a", encoding="utf-8") as history:
        while step < cfg.steps:
            idx = torch.randperm(len(examples), generator=gen)[: cfg.batch_size].tolist()
            batch = collate([examples[i] for i in idx], planes)
            model.train()
            logits, _ = model(batch["volumes"], batch["slice_mask"], batch["plane_present"])
            loss = masked_bce(logits, batch["labels"], batch["label_mask"])
            optim.zero_grad()
            loss.backward()  # type: ignore[no-untyped-call]
            optim.step()
            step += 1
            loss_value = float(loss.detach())
            history.write(json.dumps({"step": step, "loss": loss_value}) + "\n")
            if step % cfg.checkpoint_every == 0 or step == cfg.steps:
                torch.save(
                    {
                        "model": model.state_dict(),
                        "optimizer": optim.state_dict(),
                        "step": step,
                        "spec": dataclasses.asdict(spec),
                    },
                    ckpt_path,
                )

    git_sha, dirty = _git()
    metadata = {
        "run_id": run_id,
        "created_at": datetime.now(UTC).isoformat(),
        "git_sha": git_sha,
        "git_dirty": dirty,
        "seed": cfg.seed,
        "data_source": cfg.data_source,
        "data_note": data_note,
        "split_hash": split_hash,
        "finding_profile": cfg.finding_profile,
        "findings": list(findings),
        "planes": list(planes),
        "preprocessing_version": prep.version,
        "preprocessing_sha256": prep.sha256,
        "model_spec": dataclasses.asdict(spec),
        "steps_completed": step,
        "final_loss": loss_value,
        "checkpoint_sha256": sha256_file(ckpt_path),
        "torch_version": torch.__version__,
        "hardware": f"{platform.machine()} {platform.processor() or 'cpu'} x{os.cpu_count()}"
        f"{' + cuda' if torch.cuda.is_available() else ''}",
    }
    (run_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return run_dir


def _toml(data: dict[str, Any]) -> str:
    lines: list[str] = []
    for table, values in data.items():
        lines.append(f"[{table}]")
        for key, value in values.items():
            lines.append(f"{key} = {json.dumps(value)}")
        lines.append("")
    return "\n".join(lines)
