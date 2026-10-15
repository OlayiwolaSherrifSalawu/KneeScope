# Demo script — the cached prediction path (KS-EVAL-07)

The full demo narrative (case selection, narration, recordings) belongs to KS-DEMO-02/03.
This page covers what KS-EVAL-07 delivers: running the demo's prediction fallback offline
from precomputed cache entries, and what every provenance field means when presenting.

## Before the demo (once per model or preprocessing version)

1. Fill the `[model]` section of `config/model.toml` with the checkpoint path and its
   SHA-256. The checkpoint file stays outside git (`artifacts/`, git-ignored) and under
   whatever terms the dataset requires. Without it, model mode starts but answers
   `503 MODEL_NOT_LOADED` — that is deliberate, not a bug.
2. Build or refresh the demo manifest (KS-DATA-10; evaluation partitions only):

   ```bash
   python scripts/build_manifest.py --dataset rsna --root data/rsna \
       --split-file artifacts/splits/<split>.csv --n 4 \
       --out artifacts/manifest/studies.json
   ```

3. Precompute and verify the cached entries:

   ```bash
   KNEESCOPE_MODE=model KNEESCOPE_MANIFEST=artifacts/manifest/studies.json \
   KNEESCOPE_DATA_ROOT=data/rsna \
       python scripts/precompute_predictions.py --manifest artifacts/manifest/studies.json
   ```

   Expected output: one `ok <study_id> key=<12 chars> computed_at=<timestamp>` line per
   study, then `cached N/N manifest studies under <cache_dir>`, exit code 0. Any
   `FAILED` line means that study has no cache entry — fix it before the demo; the
   script exits non-zero so it cannot be missed.

## Running the demo from cache

Start the API in model mode with the same configuration and request predictions with the
default `allow_cached: true`. Every precomputed manifest study answers instantly with:

- `provenance.source = "cached"` — say "cached result", never "live run";
- `provenance.computed_at` — when the scores were actually computed. This is the
  timestamp to show and narrate; `served_at` is only when this response was handed out;
- `provenance.cache_key` — identifies the model, checkpoint, preprocessing version and
  finding profile that produced the entry;
- `latency_ms = null` — a cached answer is not a latency measurement;
- `model.checkpoint_sha256` — the checkpoint that produced the scores.

To demonstrate that staleness is safe, either send `allow_cached: false` (forces a live
run on the spot) or bump the preprocessing `version` and show the same request
recomputing: keys that no longer match the live configuration are cache misses by
design, and invalid or tampered entries are ignored and logged by key only.

## What not to say

- A dry-run checkpoint may be untrained plumbing weights; its scores are meaningless.
  The response's `trained_on` says what the checkpoint is — either narrate that honestly
  or demo with the real trained checkpoint (KS-MODEL-05).
- Never present cached scores as freshly computed, and never hand-edit cache entries:
  entries are written only by `scripts/precompute_predictions.py` from real live runs.
