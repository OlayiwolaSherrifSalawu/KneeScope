"""Inference boundary between the API and a trained model.

Rule: nothing in this module (or anything it imports) may read dataset labels.
``tests/test_label_isolation.py`` enforces this.

Checkpoint format (produced by ``kneescope_ml.train.train``): a ``torch.save`` file
with ``{"model": state_dict, "optimizer": ..., "step": ..., "spec": {...}}``.
Loading verifies the SHA-256 against ``config/model.toml`` before trusting the file.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

import numpy as np

from kneescope_ml.config import REPO_ROOT, ModelConfig
from kneescope_ml.types import ModelOutput, PreprocessedStudy

if TYPE_CHECKING:  # torch stays a runtime-optional dependency (ml extra)
    from torch import nn


class ModelNotAvailableError(RuntimeError):
    """No checkpoint is configured or it failed verification."""


class Predictor(Protocol):
    model_id: str
    model_version: str
    checkpoint_sha256: str
    supported_findings: tuple[str, ...]

    def predict(self, study: PreprocessedStudy) -> ModelOutput: ...


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass
class CheckpointPredictor:
    """Runs a loaded ``StudyModel`` over a preprocessed study."""

    model_id: str
    model_version: str
    checkpoint_sha256: str
    supported_findings: tuple[str, ...]
    planes: tuple[str, ...]
    _model: nn.Module

    def predict(self, study: PreprocessedStudy) -> ModelOutput:
        import torch

        volumes = np.stack([[study.planes[p].volume for p in self.planes]])  # (1,P,S,H,W)
        slice_mask = np.stack([[study.planes[p].mask for p in self.planes]])
        present = np.array([[study.planes[p].present for p in self.planes]])
        with torch.no_grad():
            logits, _attention = self._model(
                torch.from_numpy(volumes), torch.from_numpy(slice_mask), torch.from_numpy(present)
            )
        probs = torch.sigmoid(logits)[0]
        return ModelOutput(scores={f: float(probs[i]) for i, f in enumerate(self.supported_findings)})


def resolve_checkpoint_path(cfg: ModelConfig) -> Path:
    path = Path(cfg.checkpoint_path)
    return path if path.is_absolute() else REPO_ROOT / path


def load_predictor(cfg: ModelConfig) -> Predictor:
    """Load and verify the configured checkpoint.

    Raises ``ModelNotAvailableError`` when no checkpoint is configured, the file is
    missing, or its SHA-256 does not match ``config/model.toml`` — a stale or foreign
    file is never loaded (KS-MODEL-05).
    """
    if not cfg.has_checkpoint:
        raise ModelNotAvailableError("no checkpoint configured in config/model.toml")
    import torch

    from kneescope_ml.model import ModelSpec, StudyModel

    path = resolve_checkpoint_path(cfg)
    if not path.is_file():
        raise ModelNotAvailableError("configured checkpoint file does not exist")
    digest = sha256_file(path)
    if cfg.checkpoint_sha256 and digest != cfg.checkpoint_sha256:
        raise ModelNotAvailableError("checkpoint SHA-256 does not match config/model.toml")
    state = torch.load(path, map_location="cpu", weights_only=False)
    if not isinstance(state, dict) or "model" not in state or "spec" not in state:
        raise ModelNotAvailableError("checkpoint does not contain a model state and spec")
    model = StudyModel(ModelSpec(**state["spec"]))
    model.load_state_dict(state["model"])
    model.eval()
    return CheckpointPredictor(
        model_id=cfg.model_id,
        model_version=cfg.model_version,
        checkpoint_sha256=digest,
        supported_findings=tuple(state["spec"]["findings"]),
        planes=tuple(state["spec"]["planes"]),
        _model=model,
    )
