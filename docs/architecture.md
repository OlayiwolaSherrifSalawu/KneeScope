# KneeScope architecture

Lean monorepo, one Python environment, one web app. No gateway, no queue, no database:
the persistent state is a study manifest, a checkpoint, metrics JSON and a prediction
cache on disk (project plan §8).

```
knee-scope/
├── web/        React + TypeScript + Vite + Tailwind (DESIGN.md tokens)
├── api/        kneescope_api — FastAPI service
├── ml/         kneescope_ml — adapters, shared preprocessing/rendering, model, training, evaluation
├── contracts/  kneescope_contracts (Pydantic, canonical) + findings.json + fixtures + generated schema/OpenAPI/examples
├── config/     preprocessing.toml, model.toml (versions, placeholders)
├── scripts/    dev, verify, export contracts, backlog, design-token check
├── tests/      contract, API, ML, label-isolation tests (+ e2e later)
├── docs/       design, architecture, decisions, data audit, model card, issues
├── data/       (git-ignored) local dataset copies
└── artifacts/  (git-ignored) caches, runs, checkpoints, manifests, metrics
```

## Components

| Layer | Choice | Notes |
|---|---|---|
| Training/inference | Python, PyTorch (`ml` extra) | CPU inference for serving; training wherever compute is available |
| Data loading | Dataset adapter per dataset; pydicom (+ JPEG decoders) only where needed | `DatasetAdapter` protocol |
| Preprocessing | `kneescope_ml.preprocess.preprocess_study` | **The only implementation**; versioned by `config/preprocessing.toml` |
| Slice rendering | `kneescope_ml.render.render_slice_png` | Display mapping, not window/level |
| Backend | FastAPI (`kneescope_api`) | Fixture mode now; model mode via backlog |
| Frontend | React, TypeScript, Vite, Tailwind | Canvas viewer with server-rendered slices |
| Contracts | Pydantic → JSON Schema/OpenAPI → TS types | Drift checked in CI |
| Packaging | `uv` lockfile + `pnpm` lockfile; container in `KS-OPS-02` | |

## Run modes

| Mode | `KNEESCOPE_MODE` | Studies | Predictions | Metrics |
|---|---|---|---|---|
| Fixture (now) | `fixture` | `contracts/fixtures/studies.json` (synthetic phantoms) | `source: fixture`, `fixture-model`, no checkpoint | `unavailable` |
| Model (backlog) | `model` | Manifest of permitted studies via adapter | `source: live` or `cached` with checkpoint SHA | Snapshot for loaded `model_version` |

Model mode (`KNEESCOPE_MANIFEST` + `KNEESCOPE_DATA_ROOT`) serves `/studies`,
`/studies/{id}` and slices from the manifest through `DatasetCatalogue`
(`api/kneescope_api/catalogue.py`, KS-API-01). Predictions, explanations, labels, metrics
and the model card still return `503 MODEL_NOT_LOADED` in model mode rather than
pretending (KS-API-02, KS-API-05).

## Request flow (model mode, target)

```
POST /predictions {study_id}
  → catalogue.lookup(study_id)                         404 STUDY_NOT_FOUND
  → cache.get(study, model, checkpoint, prep, profile) hit → source=cached (original computed_at)
  → adapter.select_series(study)                       one series per plane
  → adapter.load_series(...)                           422 PREPROCESSING_FAILED / INPUT_INVALID
  → preprocess_study(study, series, prep_cfg)          shared with training
  → required plane missing?                            findings → unavailable (INPUT_INVALID)
  → predictor.predict(preprocessed)                    per-finding failures → failed
  → map to FindingResult (+ unsupported for profile findings the model lacks)
  → PredictionResponse(source=live, latency_ms)        → cache.put
```

Labels are served only by `GET /studies/{id}/labels` from `kneescope_ml.labels` and never
touch this flow (`tests/test_label_isolation.py`).

## Training and evaluation flow (target)

```
dataset → audit (KS-DATA-03) → labels file (KS-LABEL-01) → grouped splits (KS-DATA-08)
       → preprocess_study → tensor cache keyed by prep version (KS-DATA-09)
       → train (KS-MODEL-02/03): 2D backbone per slice → masked pooling per plane
         → plane fusion (plane-present masks) → independent sigmoid heads, masked BCE
       → validation: selection + thresholds (KS-EVAL-02)
       → final partition once: MetricsSnapshot (KS-EVAL-03) → model card (KS-EVAL-06)
       → checkpoint + SHA-256 → config/model.toml → API (KS-MODEL-05, KS-API-02)
```

Optional explanation branch from the slice encoder: influential slices (`KS-LABEL-03`),
Grad-CAM (`KS-LABEL-04`, optional). It does not establish lesion location.

## Data tooling (data workstream)

| Step | Code | Command |
|---|---|---|
| Read RSNA layout, order slices, pick series | `ml/kneescope_ml/adapters/rsna.py` | used by every step below |
| Audit (counts only) | `ml/kneescope_ml/audit.py` | `scripts/audit_dataset.py` |
| Grouped, stratified splits + hash | `ml/kneescope_ml/splits.py` | `scripts/make_splits.py` |
| Inspect preprocessed input | `ml/kneescope_ml/preprocess.py` | `scripts/inspect_preprocessing.py` |
| Versioned tensor cache + dataset | `ml/kneescope_ml/data.py` | `scripts/cache_tensors.py` |
| Demo manifest (evaluation partitions) | — | `scripts/build_manifest.py` |
| Synthetic RSNA-layout data for tests | `ml/kneescope_ml/synthetic_rsna.py` | used by `tests/ml/` |

All outputs go to `artifacts/` (git-ignored). Real-data runs wait for KS-DATA-01/04.

## Synchronous inference and the job-and-poll escape hatch

Inference is synchronous until measured otherwise (`KS-OPS-03`). If p95 latency exceeds
`serving.request_timeout_s`, `KS-OPS-04` adds a minimal job-and-poll flow inside the same
process: `POST /predictions` → `202 {job_id, status, poll_url}`, `GET
/predictions/jobs/{job_id}` until it returns the unchanged `PredictionResponse`. One
in-process worker and an in-memory or file job table; no Redis/Celery. `serving.mode`
in `config/model.toml` selects it. The web client change is `KS-WEB-08`.

## Versioning

Every prediction, metrics snapshot and model card carries: contract `SCHEMA_VERSION`,
finding registry version, preprocessing version + config SHA-256, model version +
checkpoint SHA-256. Changing preprocessing or the checkpoint invalidates tensor and
prediction caches by key.

## Security posture

No authentication (out of scope), so the API binds to localhost by default and must not
be exposed publicly with restricted data (`KS-OPS-05` governs any hosting). Error bodies
never include paths, request bodies or report text. CORS allows only configured origins.
Data and artifacts are git-ignored; `KS-OPS-01` adds a commit guard.
