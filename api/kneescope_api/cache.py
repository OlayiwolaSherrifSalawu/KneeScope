"""File-based prediction cache (KS-API-04 core, exercised by KS-EVAL-07).

A cache entry is keyed by study_id + model_version + checkpoint_sha256 +
preprocessing version + finding profile (contracts/README.md §6). Any mismatch is a
cache miss by design, and every key change corresponds to changed behavior.

Entries are stored in the live form and rewritten on read as provenance ``cached``:
the original ``computed_at`` is preserved, ``served_at`` is the time of this serve,
``cache_key`` is set and ``latency_ms`` is dropped. Entries that fail contract
validation are ignored (miss) and logged by key only, never by content.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from kneescope_contracts.models import PredictionResponse, ResultProvenance, ResultSource
from kneescope_ml.config import REPO_ROOT

log = logging.getLogger(__name__)


class PredictionCache:
    """One JSON file per cache key under the configured ``serving.cache_dir``."""

    def __init__(self, cache_dir: str | Path) -> None:
        self.dir = Path(cache_dir) if Path(cache_dir).is_absolute() else REPO_ROOT / cache_dir

    @staticmethod
    def key(
        study_id: str,
        model_version: str,
        checkpoint_sha256: str,
        preprocessing_version: str,
        finding_profile: str,
    ) -> str:
        payload = json.dumps(
            {
                "study_id": study_id,
                "model_version": model_version,
                "checkpoint_sha256": checkpoint_sha256,
                "preprocessing_version": preprocessing_version,
                "finding_profile": finding_profile,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _path(self, key: str) -> Path:
        return self.dir / f"{key}.json"

    def get(
        self,
        key: str,
        study_id: str,
        findings: list[str] | None = None,
    ) -> PredictionResponse | None:
        """Return a cached response rewritten as source 'cached', or None on any miss."""
        path = self._path(key)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            stored = PredictionResponse.model_validate(raw)
            if stored.provenance.source is not ResultSource.live:
                raise ValueError("entry is not a live result")
            recomputed = self.key(
                stored.study_id,
                stored.model.model_version,
                stored.model.checkpoint_sha256 or "",
                stored.preprocessing.version,
                stored.model.finding_profile,
            )
            if recomputed != key or stored.study_id != study_id:
                raise ValueError("entry does not match its cache key")
        except FileNotFoundError:
            return None
        except (OSError, ValueError, TypeError):  # tampered, stale or foreign entry
            log.warning("ignoring invalid prediction cache entry key=%s", key)
            return None

        results = stored.findings
        if findings is not None:
            wanted = set(findings)
            by_id = {f.finding_id: f for f in results}
            if not wanted <= set(by_id):
                return None  # cached entry covers a different finding set: miss
            results = [by_id[fid] for fid in findings]

        now = datetime.now(UTC)
        provenance = ResultProvenance(
            source=ResultSource.cached,
            computed_at=stored.provenance.computed_at,  # original computation time, kept
            served_at=now,
            latency_ms=None,
            cache_key=key,
        )
        payload = stored.model_dump(mode="json")
        payload["findings"] = [f.model_dump(mode="json") for f in results]
        payload["provenance"] = provenance.model_dump(mode="json")
        return PredictionResponse.model_validate(payload)

    def put(self, live: PredictionResponse) -> str:
        """Store a live result (hand-written entries are forbidden). Returns the key."""
        if live.provenance.source is not ResultSource.live:
            raise ValueError("only live results may be cached")
        if live.model.checkpoint_sha256 is None:
            raise ValueError("live model results must identify their checkpoint")
        key = self.key(
            live.study_id,
            live.model.model_version,
            live.model.checkpoint_sha256,
            live.preprocessing.version,
            live.model.finding_profile,
        )
        self.dir.mkdir(parents=True, exist_ok=True)
        tmp = self._path(key).with_suffix(".json.tmp")
        tmp.write_text(live.model_dump_json(indent=2), encoding="utf-8")
        tmp.replace(self._path(key))
        return key
