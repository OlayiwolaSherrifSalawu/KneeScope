<!-- KS-MODEL-02 | generated from docs/issues/src/04-model.toml by scripts/backlog.py; edit the source, not this file -->
# KS-MODEL-02: Training pipeline with config, seeding, checkpointing and experiment provenance

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-MODEL` |
| Workstream | modelling |
| Recommended owner role | Modelling |
| Status (from state.json) | closed |

## Problem

Training must be reproducible and auditable before any real data arrives: each run records its config, seed, git commit, preprocessing version, split hash and checkpoint hash. Building this on synthetic phantom data unblocks modelling while data access is pending.

## Expected outcome

scripts/train.py runs end to end on the fixture adapter's synthetic volumes with random labels (clearly marked smoke data), writes artifacts/runs/<run_id>/ with config.toml, metadata.json (git SHA, seed, prep version, split hash or 'synthetic'), checkpoint and its SHA-256, and appends to docs/experiments.md.

## Dependencies

- None — can start now.

- Blocks: `KS-MODEL-03` — Train the baseline model on the selected dataset

## Scope

- Model skeleton: pretrained-capable 2D backbone per slice, masked pooling per plane, plane fusion respecting plane masks, independent sigmoid heads per profile finding.
- Masked BCE (unknown labels excluded).
- Deterministic seeding, checkpoint save/resume.
- Run metadata and experiment log.

## Explicit exclusions

- Real-data training (KS-MODEL-03).
- Hyperparameter search, ensembles, TTA.

## Implementation guidance

Install torch via `uv sync --extra ml`. Default to CPU-friendly settings for the smoke run. The smoke run's metrics are meaningless and must be labelled 'synthetic smoke test' in the log.

## Relevant files and modules

- `ml/kneescope_ml/model.py`
- `ml/kneescope_ml/train.py`
- `scripts/train.py`
- `config/train.toml`
- `tests/ml/test_train_smoke.py`
- `docs/experiments.md`

## Contract impact

Implements ModelOutput (contracts §5). No schema change.

## Scientific requirements

- **Dataset and label provenance:** Synthetic phantom smoke data only.
- **Evaluation partition:** Not applicable.
- **Applicable metrics:** Loss only, labelled synthetic.
- **What cannot be claimed:** Any performance; smoke metrics are not results.
- **Reproducibility artifacts:** Run directory layout, metadata schema, experiment log.

## Acceptance criteria

- [ ] pytest tests/ml/test_train_smoke.py trains 2 steps on synthetic data on CPU in under 120 s and writes a checkpoint plus metadata.json with all required keys.
- [ ] Two runs with the same seed produce identical first-step loss (test).
- [ ] A label mask of zeros contributes zero loss (test).
- [ ] Missing-plane inputs do not change the output when their mask is false (test).

## Verification

- `uv sync --extra ml && pytest tests/ml/test_train_smoke.py`

## Documentation updates

- docs/experiments.md (new)
- docs/architecture.md (training section)

## Definition of done

- Run metadata format documented in docs/experiments.md.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
