"""Baseline study-level model (contracts/README.md sections 4-5).

slice encoder (2D backbone, shared across planes)
  -> masked attention pooling over slices, per plane
  -> masked mean over present planes
  -> independent linear heads, one sigmoid output per supported finding

Padding slices and missing planes never influence the output: their pooling weights are
zero and absent planes are excluded from the plane mean.
"""

from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import Tensor, nn


@dataclass(frozen=True)
class ModelSpec:
    findings: tuple[str, ...]
    planes: tuple[str, ...]
    backbone: str = "resnet18"
    pretrained: bool = False
    freeze_encoder: bool = True
    embed_dim: int = 512


def build_encoder(name: str, pretrained: bool) -> nn.Module:
    import torchvision

    weights = "DEFAULT" if pretrained else None
    net = getattr(torchvision.models, name)(weights=weights)
    net.fc = nn.Identity()
    return net  # type: ignore[no-any-return]


class StudyModel(nn.Module):  # type: ignore[misc]
    def __init__(self, spec: ModelSpec) -> None:
        super().__init__()
        self.spec = spec
        self.encoder = build_encoder(spec.backbone, spec.pretrained)
        if spec.freeze_encoder:
            for p in self.encoder.parameters():
                p.requires_grad = False
        self.attention = nn.Linear(spec.embed_dim, 1)
        self.heads = nn.Linear(spec.embed_dim, len(spec.findings))

    def forward(self, volumes: Tensor, slice_mask: Tensor, plane_present: Tensor) -> tuple[Tensor, Tensor]:
        """volumes (B,P,S,H,W) float; slice_mask (B,P,S) bool; plane_present (B,P) bool.

        Returns logits (B,F) and slice attention weights (B,P,S) (zeros where masked).
        """
        b, p, s, h, w = volumes.shape
        slice_mask = slice_mask & plane_present[..., None]
        flat = volumes.reshape(b * p * s, 1, h, w).expand(-1, 3, -1, -1)
        if self.spec.freeze_encoder:
            self.encoder.eval()
        feats = self.encoder(flat).reshape(b, p, s, -1)  # (B,P,S,D)
        feats = feats * slice_mask[..., None]

        scores = self.attention(feats).squeeze(-1)  # (B,P,S)
        scores = scores.masked_fill(~slice_mask, float("-inf"))
        has_slices = slice_mask.any(-1, keepdim=True)
        weights = torch.softmax(torch.where(has_slices, scores, torch.zeros_like(scores)), dim=-1)
        weights = weights * slice_mask  # absent planes -> all zeros
        plane_feats = (weights[..., None] * feats).sum(2)  # (B,P,D)

        present = (plane_present & slice_mask.any(-1)).float()  # (B,P)
        denom = present.sum(1, keepdim=True).clamp(min=1.0)
        study = (plane_feats * present[..., None]).sum(1) / denom  # (B,D)
        return self.heads(study), weights


def masked_bce(logits: Tensor, labels: Tensor, label_mask: Tensor) -> Tensor:
    """Binary cross-entropy averaged over known labels only (unknown -> mask 0)."""
    loss = nn.functional.binary_cross_entropy_with_logits(logits, labels, reduction="none")
    known = label_mask.float()
    return (loss * known).sum() / known.sum().clamp(min=1.0)
