"""Precompute cached predictions for the demo manifest (KS-EVAL-07).

  python scripts/precompute_predictions.py --manifest artifacts/manifest/studies.json

Runs the API's *live* prediction path once per manifest study — never a
reimplementation: each request goes through the real ``POST /predictions`` route in
model mode — and stores each result in the prediction cache under the configured
``serving.cache_dir``. Every entry is then verified to round-trip as source
``cached`` with the original ``computed_at``.

Cache keys include model version, checkpoint SHA-256, preprocessing version and
finding profile: regenerate after any of them changes; a stale key is a cache miss
by design. Only study ids, error codes and cache keys are printed (reviewer-safe).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from kneescope_api.main import create_app
from kneescope_api.settings import Settings
from kneescope_contracts.findings import default_profile_id
from kneescope_contracts.models import PredictionResponse, ResultSource
from kneescope_ml.config import load_model_config, load_preprocessing_config


def run(
    manifest: Path,
    data_root: Path | None,
    model_config: Path | None = None,
    preprocessing_config: Path | None = None,
) -> int:
    study_ids = [entry["study_id"] for entry in json.loads(manifest.read_text(encoding="utf-8"))["studies"]]
    root = data_root or os.environ.get("KNEESCOPE_DATA_ROOT")
    if root is None:
        print("data root unknown: pass --data-root or set KNEESCOPE_DATA_ROOT")
        return 2
    settings = Settings(
        mode="model",
        finding_profile=os.environ.get("KNEESCOPE_FINDING_PROFILE", default_profile_id()),
        cors_origins=(),
        log_level=os.environ.get("KNEESCOPE_LOG_LEVEL", "warning"),
        manifest=manifest,
        data_root=Path(root),
        dataset=None,
    )
    model_cfg = load_model_config(model_config)
    prep_cfg = load_preprocessing_config(preprocessing_config)
    app = create_app(settings, model_cfg=model_cfg, prep_cfg=prep_cfg)
    cache = app.state.ks.cache
    assert cache is not None

    done: list[str] = []
    with TestClient(app) as client:
        for study_id in study_ids:
            live = client.post("/predictions", json={"study_id": study_id, "allow_cached": False})
            if live.status_code != 200:
                code = live.json().get("error", {}).get("code", "UNKNOWN")
                print(f"FAILED {study_id}: live run returned {code}")
                continue
            response = PredictionResponse.model_validate(live.json())
            key = cache.put(response)

            served = client.post("/predictions", json={"study_id": study_id})
            if served.status_code != 200:
                print(f"FAILED {study_id}: cached fetch returned {served.status_code}")
                continue
            provenance = PredictionResponse.model_validate(served.json()).provenance
            if (
                provenance.source is not ResultSource.cached
                or provenance.cache_key != key
                or provenance.computed_at != response.provenance.computed_at
                or provenance.latency_ms is not None
                or provenance.served_at < provenance.computed_at
            ):
                print(f"FAILED {study_id}: cached round-trip did not preserve provenance")
                continue
            done.append(study_id)
            print(f"ok {study_id} key={key[:12]} computed_at={provenance.computed_at.isoformat()}")
    print(f"cached {len(done)}/{len(study_ids)} manifest studies under {cache.dir}")
    return 0 if len(done) == len(study_ids) else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="Precompute cached predictions for the demo manifest.")
    ap.add_argument("--manifest", type=Path, default=Path("artifacts/manifest/studies.json"))
    ap.add_argument("--data-root", type=Path, default=None)
    ap.add_argument("--model-config", type=Path, default=None, help="alternative config/model.toml")
    ap.add_argument("--preprocessing-config", type=Path, default=None)
    args = ap.parse_args()
    if not args.manifest.is_file():
        print(f"manifest not found: {args.manifest}")
        return 2
    return run(args.manifest, args.data_root, args.model_config, args.preprocessing_config)


if __name__ == "__main__":
    sys.exit(main())
