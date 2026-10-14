"""KS-MODEL-02: training pipeline smoke tests on synthetic phantoms (CPU)."""

import json
import time
from pathlib import Path

import numpy as np
import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("torchvision")

from kneescope_ml.config import load_preprocessing_config  # noqa: E402
from kneescope_ml.model import ModelSpec, StudyModel, masked_bce  # noqa: E402
from kneescope_ml.train import (  # noqa: E402
    RUN_METADATA_KEYS,
    TrainConfig,
    collate,
    synthetic_examples,
    train,
)

ROOT = Path(__file__).resolve().parents[2]


def small_config(steps: int = 2) -> TrainConfig:
    cfg = TrainConfig.load(ROOT / "config/train.toml")
    raw = {k: dict(v) for k, v in cfg.raw.items()}
    raw["run"].update(steps=steps, batch_size=2, checkpoint_every=1)
    raw["smoke"].update(num_slices=4, size=32, n_studies=4)
    return TrainConfig(
        raw=raw,
        seed=cfg.seed,
        steps=steps,
        batch_size=2,
        lr=cfg.lr,
        weight_decay=cfg.weight_decay,
        checkpoint_every=1,
        spec_kwargs=cfg.spec_kwargs,
        data_source=cfg.data_source,
        finding_profile=cfg.finding_profile,
    )


def test_two_step_smoke_run_writes_checkpoint_and_metadata(tmp_path):
    cfg = small_config()
    prep = load_preprocessing_config()
    start = time.monotonic()
    run_dir = train(cfg, synthetic_examples(cfg, prep), tmp_path, prep=prep, run_id="smoke")
    assert time.monotonic() - start < 120
    meta = json.loads((run_dir / "metadata.json").read_text())
    assert set(RUN_METADATA_KEYS) <= set(meta)
    assert meta["steps_completed"] == 2 and meta["split_hash"] == "synthetic"
    assert "SYNTHETIC" in meta["data_note"]
    assert (run_dir / "checkpoint.pt").exists() and len(meta["checkpoint_sha256"]) == 64
    assert (run_dir / "config.toml").read_text().startswith("[run]")


def test_same_seed_gives_identical_first_loss(tmp_path):
    cfg = small_config(steps=1)
    prep = load_preprocessing_config()
    losses = []
    for name in ("a", "b"):
        run_dir = train(cfg, synthetic_examples(cfg, prep), tmp_path, prep=prep, run_id=name)
        losses.append(json.loads((run_dir / "history.jsonl").read_text().splitlines()[0])["loss"])
    assert losses[0] == losses[1]


def test_resume_continues_from_checkpoint(tmp_path):
    cfg1, cfg3 = small_config(steps=1), small_config(steps=3)
    prep = load_preprocessing_config()
    examples = synthetic_examples(cfg1, prep)
    train(cfg1, examples, tmp_path, prep=prep, run_id="r")
    run_dir = train(cfg3, examples, tmp_path, prep=prep, run_id="r", resume=True)
    assert json.loads((run_dir / "metadata.json").read_text())["steps_completed"] == 3


def test_unknown_labels_contribute_no_loss():
    logits = torch.tensor([[5.0, -5.0]])
    labels = torch.tensor([[0.0, 1.0]])  # badly wrong if counted
    assert masked_bce(logits, labels, torch.zeros_like(labels, dtype=torch.bool)).item() == 0.0
    assert masked_bce(logits, labels, torch.ones_like(labels, dtype=torch.bool)).item() > 1.0


def test_missing_plane_and_padding_do_not_change_output():
    cfg = small_config()
    prep = load_preprocessing_config()
    examples = synthetic_examples(cfg, prep)
    ex = next(e for e in examples if not e.study.planes["sagittal"].present)  # fx-study-004
    planes = ("sagittal", "coronal", "axial")
    torch.manual_seed(0)
    model = StudyModel(ModelSpec(findings=("acl", "mcl"), planes=planes)).eval()
    batch = collate([ex], planes)
    with torch.no_grad():
        base, attn = model(batch["volumes"], batch["slice_mask"], batch["plane_present"])
        noisy = batch["volumes"].clone()
        noisy[:, 0] = torch.randn_like(noisy[:, 0]) * 10  # garbage in the missing sagittal plane
        changed, _ = model(noisy, batch["slice_mask"], batch["plane_present"])
    assert torch.allclose(base, changed)
    assert float(attn[0, 0].abs().sum()) == 0.0  # no attention on the missing plane
    assert np.isclose(float(attn[0, 1].sum()), 1.0)  # present plane's weights sum to 1
