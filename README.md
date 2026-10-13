# KneeScope

**Knee MRI research review prototype — not for diagnosis.**

KneeScope lets a researcher inspect a knee MRI study, review model scores for the
findings the selected dataset supports, compare them with dataset labels in a separate
step, and examine measured performance and limitations. It is a standalone hackathon
project (Learn2Earn), not a Kaggle submission.

> **Current state: scaffold in fixture mode.** No dataset has been selected and no model
> has been trained. Every study is a synthetic geometric phantom (not an MRI) and every
> result is a labelled **FIXTURE**. Metrics read "unavailable". See
> [`docs/issue-index.md`](docs/issue-index.md) for what remains.

## Quick start (fixture mode)

Prerequisites: Python ≥ 3.12 with [`uv`](https://docs.astral.sh/uv/), Node 24 with `pnpm`.

```bash
uv sync                       # Python deps (API, contracts, preprocessing; no torch)
pnpm --dir web install        # web deps
scripts/dev.sh                # API on :8000 (fixture mode) + web on :5173
```

Open http://localhost:5173. API docs: http://localhost:8000/docs. Health:
`curl localhost:8000/healthz`.

Run only the API: `scripts/dev-api.sh`. Configuration: copy `.env.example` to `.env`
(names only; never put secrets in the repository).

## Verify

```bash
scripts/verify.sh
```

Runs design-token contrast/hue checks, backlog graph check, docs link check, ruff,
mypy, pytest, contract drift check, and web lint/typecheck/format/test/build. CI
(`.github/workflows/ci.yml`) runs the same checks.

## Repository map

| Path | What |
|---|---|
| [`DESIGN.md`](DESIGN.md) | Canonical design specification ("Lightbox & Ledger") |
| [`docs/design/design-concept.html`](docs/design/design-concept.html) | Self-contained visual concept — open in a browser |
| [`AGENTS.md`](AGENTS.md) | How people and agents collaborate here |
| [`contracts/`](contracts/README.md) | Shared contracts (Pydantic source, JSON Schema, OpenAPI, fixtures, examples) |
| `api/` | FastAPI service (`kneescope_api`) |
| `ml/` | Adapters, shared preprocessing and rendering, inference boundary (`kneescope_ml`) |
| `web/` | React + TypeScript + Vite app |
| `config/` | `preprocessing.toml`, `model.toml` — version placeholders |
| `scripts/` | Dev, verification, contract export, backlog tools |
| `tests/` | Contract, API, preprocessing and label-isolation tests |
| [`docs/architecture.md`](docs/architecture.md) | System design, run modes, request flow |
| [`docs/decisions.md`](docs/decisions.md) | Decision log and open decisions |
| [`docs/issue-index.md`](docs/issue-index.md) | Backlog overview, first ready issues, critical path |
| [`docs/model-card.md`](docs/model-card.md), [`docs/data-audit.md`](docs/data-audit.md) | Templates to fill from evidence |

## One layout

The team's original scaffold (`src/knee_api`, `src/kneeml`, `docs/contracts/`, `configs/`)
was merged and then consolidated into this layout (`docs/decisions.md` D-011, D-012).
Its useful parts were carried over: CODEOWNERS (remapped to the new paths), `/readyz`,
client `X-Request-ID` support, the Makefile, Docker setup and pre-commit hooks.
`scripts/check_layout.py` keeps the retired paths from coming back. Common commands:
`make help`.

## Run modes

| Mode | How | Results |
|---|---|---|
| Fixture | `KNEESCOPE_MODE=fixture` (default) | Synthetic studies; `FIXTURE — not a model output` |
| Model | `KNEESCOPE_MODE=model` | Not implemented yet — returns `503 MODEL_NOT_LOADED` (KS-API-01/02) |
| Cached | Planned (KS-API-04) | `CACHED` with original timestamp and checkpoint |

Heavy ML dependencies (torch, pydicom, scikit-learn) install with `uv sync --extra ml`.

## Data and model artifacts

Datasets, caches, checkpoints and manifests live under `data/` and `artifacts/`, both
git-ignored. Each person accepts dataset terms personally; do not share data, reports or
rendered images beyond what the terms permit ([`docs/data-audit.md`](docs/data-audit.md) §1).

## Limitations (always)

Scores are uncalibrated model scores, not probabilities. AUC is not accuracy. Model
attention does not localise injuries. Planes are not spatially synchronised. A model
trained on one dataset is not validated on another. No clinical use.
