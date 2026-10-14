"""Runtime settings from environment variables (see .env.example)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from kneescope_contracts.findings import default_profile_id


@dataclass(frozen=True)
class Settings:
    mode: Literal["fixture", "model"]
    finding_profile: str
    cors_origins: tuple[str, ...]
    log_level: str
    # Model mode (KS-API-01): permitted studies and where their files live (outside git).
    manifest: Path | None = None
    data_root: Path | None = None
    dataset: Literal["rsna"] = "rsna"


def load_settings() -> Settings:
    mode = os.environ.get("KNEESCOPE_MODE", "fixture")
    if mode not in ("fixture", "model"):
        raise ValueError("KNEESCOPE_MODE must be 'fixture' or 'model'")
    origins = os.environ.get("KNEESCOPE_CORS_ORIGINS", "http://localhost:5173")
    manifest = os.environ.get("KNEESCOPE_MANIFEST") or None
    data_root = os.environ.get("KNEESCOPE_DATA_ROOT") or None
    if mode == "model" and not (manifest and data_root):
        # Names only: never echo local paths (docs/security.md).
        raise ValueError("KNEESCOPE_MODE=model requires KNEESCOPE_MANIFEST and KNEESCOPE_DATA_ROOT")
    dataset = os.environ.get("KNEESCOPE_DATASET", "rsna")
    if dataset != "rsna":
        raise ValueError("KNEESCOPE_DATASET must be 'rsna' (the only adapter so far)")
    return Settings(
        mode=mode,  # type: ignore[arg-type]
        finding_profile=os.environ.get("KNEESCOPE_FINDING_PROFILE", default_profile_id()),
        cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
        log_level=os.environ.get("KNEESCOPE_LOG_LEVEL", "info"),
        manifest=Path(manifest) if manifest else None,
        data_root=Path(data_root) if data_root else None,
        dataset=dataset,  # type: ignore[arg-type]
    )
