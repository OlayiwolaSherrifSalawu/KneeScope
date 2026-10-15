# Issue index

**Where the issues are:** published on GitHub at
https://github.com/OlayiwolaSherrifSalawu/KneeScope/issues (70 issues: 9 epics with
native sub-issues, 61 actionable issues with native "blocked by" links and `Blocked by`
lines in each body). `docs/issues/published.json` maps every `KS-` ID to its issue number.
Re-publishing is idempotent (existing issues are matched by ID and updated):

```bash
python scripts/backlog.py render
python scripts/publish_issues.py --repo OlayiwolaSherrifSalawu/KneeScope --dry-run
```

- Source of truth: `docs/issues/src/*.toml` (edit these).
- Generated: one body per issue `docs/issues/KS-*.md`, [`manifest.md`](issues/manifest.md),
  `manifest.json`. Status from `docs/issues/state.json`.
- Checks: `python scripts/backlog.py check` validates required fields, references, the
  acyclic dependency graph, conditional triggers, design references on UI issues,
  science sections on scientific issues, and that required work never depends on
  optional work.

**Totals:** 9 epics, 61 issues — 41 required tasks, 5 required human decisions, 7 conditional, 8 optional.

## Completed in the scaffold (not open work)

These were delivered by the scaffold and verified (see "Scaffold verification"). They are
deliberately **not** backlog issues.

| Item | Evidence |
|---|---|
| Design concept: three directions assessed, one selected | [`docs/design/design-concept.md`](design/design-concept.md) |
| Interactive HTML concept (studies, review, evaluation, states) | [`docs/design/design-concept.html`](design/design-concept.html); screenshots at 1440/661/375 px |
| Canonical design spec + token contrast/hue checker | [`DESIGN.md`](../DESIGN.md), `scripts/check_design_tokens.py` |
| Shared contracts (Pydantic) + findings registry + profiles | [`contracts/README.md`](../contracts/README.md) |
| Generated JSON Schema, OpenAPI, example responses, drift check | `contracts/schema/`, `contracts/openapi.json`, `contracts/examples/`, `scripts/export_contracts.py --check` |
| Explicit FIXTURE development data (synthetic phantoms, no anatomy) | `contracts/fixtures/` |
| FastAPI service in fixture mode: health, findings, studies, slices, predictions, explanations, labels, metrics, model card, structured errors | `api/kneescope_api/` |
| Shared preprocessing + rendering (placeholder parameters, functional) | `ml/kneescope_ml/preprocess.py`, `render.py`, `config/preprocessing.toml` |
| Adapter protocol + synthetic fixture adapter; inference boundary placeholder | `ml/kneescope_ml/adapters/`, `inference.py` |
| Tests: contract rules, API behaviour, preprocessing, label isolation | `tests/` |
| Web app shell (React/TS/Vite) wired to the API | `web/` |
| Tooling: uv + pnpm lockfiles, ruff, mypy, ESLint, Prettier, Vitest, CI | `pyproject.toml`, `uv.lock`, `web/`, `.github/workflows/ci.yml` |
| Collaboration rules, architecture, decisions, templates | `AGENTS.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/model-card.md`, `docs/data-audit.md` |

## Epics and coverage

| Epic | Required | Conditional | Optional | Covers |
|---|---|---|---|---|
| [KS-EPIC-SCOPE](issues/KS-EPIC-SCOPE.md) | SCOPE-01, SCOPE-02 | SCOPE-03 | — | Organizer requirements, ownership, interaction-prototype path |
| [KS-EPIC-DATA](issues/KS-EPIC-DATA.md) | DATA-01…10 | — | — | Access/permissions, alternatives, audit, dataset + finding choice, adapter, orientation/series/corrupt inputs, shared preprocessing, grouped splits + leakage, tensor cache + loaders, demo studies + manifest |
| [KS-EPIC-LABELS](issues/KS-EPIC-LABELS.md) | LABEL-01, LABEL-03 | LABEL-02 | LABEL-04 | Labels + provenance + unknowns, report extraction only if required, influential slices, Grad-CAM |
| [KS-EPIC-MODEL](issues/KS-EPIC-MODEL.md) | MODEL-01, 02, 03, 05 | MODEL-04 | OPT-06 | Simple comparator, training pipeline + provenance, baseline, packaging; improvement round; more findings |
| [KS-EPIC-EVAL](issues/KS-EPIC-EVAL.md) | EVAL-01, 02, 03, 04, 06, 07 | EVAL-05 | — | Metrics module, thresholds, held-out evaluation, error analysis, model card, cached demo predictions; calibration |
| [KS-EPIC-API](issues/KS-EPIC-API.md) | API-01…05 | — | OPT-01, OPT-05 | Catalogue + slice rendering, live inference, explanations, cache provenance, labels/metrics/model card; upload; true window/level |
| [KS-EPIC-WEB](issues/KS-EPIC-WEB.md) | WEB-01…07 | WEB-08 | OPT-02, 03, 04, 07 | Study browser, viewer, finding states + provenance, label reveal, explanations, evaluation ledger, a11y + responsive; job polling; notes, threshold explorer, export, thumbnails |
| [KS-EPIC-QUALITY](issues/KS-EPIC-QUALITY.md) | OPS-01, 02, 03, QA-01 | OPS-04, OPS-05 | — | Restricted assets, container setup, latency/memory, E2E tests; job-and-poll; permitted deployment |
| [KS-EPIC-DELIVERY](issues/KS-EPIC-DELIVERY.md) | DOC-01, DEMO-01, 02, 03, DEL-01, QA-02 | — | — | Reproducible README, demo cases, script, recorded fallback, delivery, completion review |

Full table with dependencies: [`issues/manifest.md`](issues/manifest.md).

## Required-deliverable coverage

| Deliverable (task brief / plan) | Issue(s) |
|---|---|
| Product scope and organizer requirements | KS-SCOPE-01, KS-SCOPE-02 |
| Dataset access and permitted use | KS-DATA-01, KS-DATA-02 |
| Dataset choice and supported finding list | KS-DATA-04 |
| Data audit and label availability | KS-DATA-03, KS-LABEL-01 |
| Report-label extraction only if required | KS-LABEL-02 (conditional) |
| Patient/study splits and leakage prevention | KS-DATA-08 |
| Dataset adapters | KS-DATA-05 |
| Orientation and series handling; missing and corrupt inputs | KS-DATA-05, KS-DATA-06 |
| Shared preprocessing | KS-DATA-07 (scaffold implementation exists) |
| Data caching and loaders | KS-DATA-09 |
| Simple baseline comparison | KS-MODEL-01 |
| Baseline model and training | KS-MODEL-02, KS-MODEL-03 |
| Checkpointing and experiment provenance | KS-MODEL-02, KS-MODEL-05 |
| Evaluation and error analysis | KS-EVAL-01, KS-EVAL-03, KS-EVAL-04 |
| Threshold selection | KS-EVAL-02 |
| Calibration only if justified | KS-EVAL-05 (conditional) |
| Optional explanations and alignment checks | KS-LABEL-03, KS-LABEL-04 (optional), KS-API-03, KS-WEB-05 |
| Model packaging | KS-MODEL-05 |
| API integration | KS-API-01, KS-API-02, KS-API-05 |
| Live/cached result provenance | KS-API-04, KS-EVAL-07, KS-WEB-03 |
| Slice rendering | KS-API-01, KS-WEB-02 |
| Study browser | KS-WEB-01 |
| Review workspace | KS-WEB-02, KS-WEB-03, KS-WEB-04, KS-WEB-05 |
| Finding states | KS-WEB-03 (contract enforced already) |
| Evaluation and model-card view | KS-WEB-06, KS-EVAL-06 |
| Accessibility and responsive behaviour | KS-WEB-07 |
| Loading/error/empty states | KS-WEB-01, KS-WEB-03, KS-WEB-06, KS-WEB-07 |
| Security and restricted-asset handling | KS-OPS-01 |
| Performance measurement | KS-OPS-03 |
| Conditional inference jobs | KS-OPS-04, KS-WEB-08 (conditional) |
| Meaningful tests and CI | KS-QA-01 (+ tests in every issue's acceptance criteria) |
| Integration verification | KS-QA-01, KS-QA-02 |
| Local/container setup | KS-OPS-02 |
| Permitted deployment if required | KS-OPS-05 (conditional) |
| Documentation and reproducibility | KS-DOC-01, KS-EVAL-06 |
| Demo selection and demo script | KS-DEMO-01, KS-DEMO-02 |
| Recorded fallback | KS-DEMO-03 |
| Final delivery and completion review | KS-DEL-01, KS-QA-02 |
| Interaction-prototype fallback if no data | KS-SCOPE-03 (conditional) |

## First ready issues (no open prerequisites)

Run `python scripts/backlog.py ready` for the live list.

| Issue | Why now |
|---|---|
| [KS-SCOPE-01](issues/KS-SCOPE-01.md) | Defines "done" for delivery; human decision |
| [KS-SCOPE-02](issues/KS-SCOPE-02.md) | Named owners; human decision |
| [KS-DATA-01](issues/KS-DATA-01.md) | **Most urgent:** RSNA rules must be accepted by 15 Oct 2026 23:59 UTC by each data handler |
| [KS-DATA-02](issues/KS-DATA-02.md) | MRNet/organizer fallback, in parallel |
| [KS-MODEL-02](issues/KS-MODEL-02.md) | Training pipeline on synthetic data, no data needed |
| [KS-EVAL-01](issues/KS-EVAL-01.md) | Metrics module on synthetic arrays |
| [KS-WEB-01](issues/KS-WEB-01.md), [KS-WEB-02](issues/KS-WEB-02.md), [KS-WEB-03](issues/KS-WEB-03.md), [KS-WEB-04](issues/KS-WEB-04.md), [KS-WEB-06](issues/KS-WEB-06.md) | Built on fixtures; independent files |
| [KS-OPS-01](issues/KS-OPS-01.md) | Restricted-asset guard before any data arrives |

## Critical path and blockers

Longest chain of required work (from `manifest.json`):

`KS-DATA-01 → KS-DATA-03 → KS-DATA-04 → KS-DATA-05 → KS-DATA-06 → KS-DATA-07 →
KS-DATA-09 → KS-MODEL-03 → KS-MODEL-05 → KS-API-02 → KS-API-04 → KS-EVAL-07 →
KS-DEMO-01 → KS-DEMO-02 → KS-DEMO-03 → KS-DEL-01`

Critical blockers:

1. **Data access and permissions (KS-DATA-01/02)** gate every model, evaluation and
   real-data API issue. RSNA's ~570 GB size means a per-study subset download plan is
   needed; only a small subset of RSNA training studies is labelled.
2. **Dataset/finding decision (KS-DATA-04)** — the finding list, contracts profile, and
   whether report extraction (KS-LABEL-02) or the interaction-prototype path
   (KS-SCOPE-03) are triggered.
3. **Compute for KS-MODEL-03** — no GPU subscription is assumed.
4. **Organizer requirements (KS-SCOPE-01)** — decide whether deployment (KS-OPS-05) and
   which recording/demo formats are required.

## Conditional issues and triggers

| Issue | Trigger | Decided by | Status |
|---|---|---|---|
| [KS-SCOPE-03](issues/KS-SCOPE-03.md) | No usable training data | KS-DATA-04 | pending |
| [KS-LABEL-02](issues/KS-LABEL-02.md) | Labelled subset too small and extraction permitted | KS-DATA-04 | pending |
| [KS-MODEL-04](issues/KS-MODEL-04.md) | Baseline clearly above comparator and compute remains | KS-EVAL-03 | pending |
| [KS-EVAL-05](issues/KS-EVAL-05.md) | Enough validation positives/negatives for calibration | KS-EVAL-03 | pending |
| [KS-OPS-04](issues/KS-OPS-04.md) | p95 latency > request timeout | KS-OPS-03 | pending |
| [KS-WEB-08](issues/KS-WEB-08.md) | KS-OPS-04 implemented | KS-OPS-04 | pending |
| [KS-OPS-05](issues/KS-OPS-05.md) | Organizers require a live link and terms allow hosting | KS-SCOPE-01, KS-DATA-01/02 | pending |

## Optional enhancements (never block delivery)

[KS-LABEL-04](issues/KS-LABEL-04.md) Grad-CAM ·
[KS-OPT-01](issues/KS-OPT-01.md) upload ·
[KS-OPT-02](issues/KS-OPT-02.md) reviewer notes ·
[KS-OPT-03](issues/KS-OPT-03.md) threshold explorer ·
[KS-OPT-04](issues/KS-OPT-04.md) research summary export ·
[KS-OPT-05](issues/KS-OPT-05.md) true window/level ·
[KS-OPT-06](issues/KS-OPT-06.md) additional findings ·
[KS-OPT-07](issues/KS-OPT-07.md) thumbnail strip

## Out of scope (no issues, by design)

Kaggle submission pipeline · report–image fusion · ensembles, TTA, extensive tuning ·
accounts, authentication, billing · EHR/PACS integration · diagnosis or treatment
recommendations · segmentation or injury grading · clinical deployment · Node gateway,
Redis, database · paid GPU hosting.

## Closed (with evidence on the GitHub issue)

| Issue | GitHub | Merged via |
|---|---|---|
| KS-OPS-01 restricted-asset guard | #53 | #72 → #84 |
| KS-EVAL-01 metrics module | #33 | #73 → #84 |
| KS-MODEL-02 training pipeline | #29 | #79 → #84 |
| KS-WEB-01 study browser | #45 | #74 → #84 |
| KS-WEB-02 slice viewer | #46 | #76 → #84 |
| KS-WEB-03 finding states + provenance | #47 | #77 → #84 |
| KS-WEB-04 dataset label reveal | #48 | #78 → #84 |
| KS-WEB-05 explanation panel | #49 | #84 |
| KS-WEB-06 evaluation ledger | #50 | #75 → #84 |
| KS-API-01 dataset-backed catalogue | #40 | #84 |

Owner wording reviews still requested on WEB-04/05 (Labels) and WEB-06 (Evaluation).
Data issues KS-DATA-01…10 have code on `main` but stay open until real-data runs.

## In progress

| Issue | Owner | Branch | Since |
|---|---|---|---|
| [KS-EVAL-07](issues/KS-EVAL-07.md) | Codebuff (agent, on behalf of the evaluation workstream) | `ks/KS-EVAL-07-precompute-cached-predictions` | 2026-10-15 |

## Scaffold verification

Recorded at scaffold time (2026-10-13); rerun with `scripts/verify.sh`.

| Check | Result |
|---|---|
| Design concept opens | Opened in a browser at 1440, 661 and 375 px: all four views render, no console errors, no horizontal overflow at 375 px; simulated run, overlay, label reveal and keyboard stepping exercised |
| Design tokens | `scripts/check_design_tokens.py`: 20 contrast pairs pass (body ≥ 7:1, secondary ≥ 4.5:1, borders/focus ≥ 3:1); no token in the blue/purple hue band |
| Backlog graph | `scripts/backlog.py check`: 9 epics, 61 issues, all fields present, acyclic; no required issue depends on optional work |
| Docs | `scripts/check_docs.py`: all local links resolve, no placeholders outside templates |
| Python lint/format/types | ruff check + format: clean; mypy strict: no issues in 19 files |
| Python tests | 34 passed (contracts, API in fixture mode, preprocessing, label isolation) |
| Contracts agree | `export_contracts.py --check` and `pnpm gen:api:check` up to date; examples validate against exported JSON Schema (test) |
| Web | install (frozen), lint, typecheck, Prettier, 11 Vitest tests, production build: all pass |
| Backend health/schema | `GET /healthz` returns fixture mode and the preprocessing version; OpenAPI lists every contract route (test) |
| Fixture provenance visible | Running app: FIXTURE origin on every study, "Fixture mode" chip, hatched "FIXTURE — not a model output" strip and row stripes after analysis, "SYNTHETIC - NOT AN MRI" in every rendered slice |
| Not run | CI on GitHub (no remote); Docker (out of scaffold scope, KS-OPS-02); model mode (not implemented, returns 503 by design) |
