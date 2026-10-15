<!-- KS-EVAL-01 | generated from docs/issues/src/05-eval.toml by scripts/backlog.py; edit the source, not this file -->
# KS-EVAL-01: Metrics module: per-finding AUCs with undefined handling, counts, threshold metrics and macro AUC

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-EVAL` |
| Workstream | evaluation |
| Recommended owner role | Evaluation |
| Status (from state.json) | closed |

## Problem

Every downstream number flows through one metrics implementation. It must exclude unknown labels, report undefined ROC AUC explicitly when a partition has one class, never convert undefined to 0 or 0.5, and emit a MetricsSnapshot that validates against the contract.

## Expected outcome

kneescope_ml.evaluation.compute_metrics(scores, labels, partition, ...) returns a MetricsSnapshot with per-finding counts, ROC AUC, PR AUC, prevalence, sensitivity/specificity at a supplied threshold, Brier score, and macro AUC with included/excluded lists.

## Dependencies

- None — can start now.

- Blocks: `KS-MODEL-01` — Simple comparator baseline for every selected finding
- Blocks: `KS-EVAL-02` — Select per-finding operating thresholds on the validation partition

## Scope

- Implement with scikit-learn (ml extra) or numpy.
- Unknown and not_labeled excluded per finding; n_unknown reported.
- Single-class → undefined_single_class with reason.
- Macro AUC over defined findings only; excluded listed.
- Unit tests on hand-computed small examples.

## Explicit exclusions

- Threshold selection (KS-EVAL-02).
- Bootstrap confidence intervals (optional; may be added later).

## Implementation guidance

Can start now on synthetic arrays. 'Accuracy' is not part of the snapshot.

## Relevant files and modules

- `ml/kneescope_ml/evaluation.py`
- `tests/ml/test_evaluation.py`

## Contract impact

Produces MetricsSnapshot/FindingMetrics (contracts §9). No schema change expected; any needed field is a contract change.

## Scientific requirements

- **Dataset and label provenance:** Synthetic arrays in tests.
- **Evaluation partition:** Parameter of the function; never inferred.
- **Applicable metrics:** ROC AUC, PR AUC, prevalence, sensitivity, specificity, Brier, macro ROC AUC.
- **What cannot be claimed:** Accuracy; that macro AUC covers excluded findings.
- **Reproducibility artifacts:** Unit tests with hand-computed values.

## Acceptance criteria

- [ ] Test: labels [1,1,1] for a finding → roc_auc.status 'undefined_single_class', value null, and the finding appears in macro_roc_auc.excluded.
- [ ] Test: unknown labels are excluded from both counts and AUC (result equals AUC on the known subset).
- [ ] Test: ROC AUC on a hand-computed 6-sample example matches to 1e-9.
- [ ] Output validates as MetricsSnapshot (status 'available', origin 'dataset') when given complete metadata.

## Verification

- `uv sync --extra ml && pytest tests/ml/test_evaluation.py`

## Documentation updates

- contracts/README.md §9 (only if behaviour clarifies)

## Definition of done

- Reviewed by someone from modelling.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
