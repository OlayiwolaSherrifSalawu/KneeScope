<!-- KS-API-01 | generated from docs/issues/src/06-api.toml by scripts/backlog.py; edit the source, not this file -->
# KS-API-01: Dataset-backed study catalogue and slice rendering in model mode

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-API` |
| Workstream | backend |
| Recommended owner role | Backend/serving |
| Status (from state.json) | closed |

## Problem

In model mode the API returns MODEL_NOT_LOADED for every route. /studies, /studies/{id} and the slice endpoint must serve the permitted manifest studies through the dataset adapter and the shared renderer, while fixture mode keeps working unchanged.

## Expected outcome

A StudyCatalogue interface with FixtureCatalogue and DatasetCatalogue implementations; model mode serves manifest studies (origin 'dataset'); slices are rendered by kneescope_ml.render with an LRU cache; restricted paths never appear in responses or logs.

## Dependencies

- Blocked by: `KS-DATA-05` — Dataset adapter: study listing, plane assignment, series selection and slice ordering
- Blocked by: `KS-DATA-06` — Handle orientation metadata, transfer syntaxes, missing series and corrupt inputs

- Blocks: `KS-API-02` — Live inference through shared preprocessing in POST /predictions
- Blocks: `KS-API-05` — Serve real labels, metrics snapshot and model card
- Blocks: `KS-OPT-05` — [Optional] Server-side true window/level rendering

## Scope

- Catalogue abstraction in api/kneescope_api/store.py.
- Manifest path from KNEESCOPE_MANIFEST env var.
- Slice endpoint uses adapter.load_series + render_slice_png; cache rendered PNGs in memory.
- Tests run with a generated synthetic DICOM manifest.

## Explicit exclusions

- Prediction (KS-API-02).
- Upload of arbitrary studies (optional KS-OPT-01).

## Implementation guidance

Keep the response contracts identical across modes; only origin and dataset_id differ. Path-like IDs are rejected by the existing pattern; keep it.

## Relevant files and modules

- `api/kneescope_api/store.py`
- `api/kneescope_api/main.py`
- `api/kneescope_api/settings.py`
- `tests/api/test_catalogue.py`
- `.env.example`

## Contract impact

None (uses StudyList/StudyDetail).

## Acceptance criteria

- [ ] With KNEESCOPE_MODE=model and a synthetic manifest, GET /studies returns origin 'dataset' entries that validate as StudyList (test).
- [ ] Slice PNG dimensions equal rendered_width × rendered_height from the study detail (test).
- [ ] A slice index ≥ num_slices returns 404 SLICE_OUT_OF_RANGE (test).
- [ ] Fixture-mode tests still pass unchanged.
- [ ] No response or log line contains the data root path (test captures logs).

## Verification

- `pytest tests/api`
- KNEESCOPE_MODE=model KNEESCOPE_MANIFEST=... uvicorn kneescope_api.main:app

## Documentation updates

- docs/architecture.md (catalogue)
- README.md (run modes)
- .env.example

## Definition of done

- Frontend owner verified the Review page against model mode with synthetic data.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
