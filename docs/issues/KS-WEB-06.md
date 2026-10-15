<!-- KS-WEB-06 | generated from docs/issues/src/07-web.toml by scripts/backlog.py; edit the source, not this file -->
# KS-WEB-06: Evaluation and model-card ledger view

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | closed |

## Problem

The evaluation page must show what was measured, on which partition, with counts — and show 'Metrics unavailable' or 'Undefined — one class only' explicitly rather than hiding or inventing numbers.

## Expected outcome

Ledger view per DESIGN.md §9.11–9.12 rendering MetricsSnapshot (available and unavailable), FindingMetrics with all MetricValue statuses, macro AUC with exclusions, inference measurements, partition wording ('Validation' vs 'Held-out test'), and the model card.

## Dependencies

- None — can start now.

- Blocks: `KS-WEB-07` — Accessibility and responsive verification across all pages
- Blocks: `KS-DEMO-02` — Demo script and rehearsal
- Blocks: `KS-OPT-03` — [Optional] Exploratory threshold slider per finding
- Blocks: `KS-OPT-04` — [Optional] Exportable research summary

## Scope

- Header facts block: dataset, partition, split method, grouping unit, model and preprocessing versions, snapshot time.
- Metrics table with counts and per-status rendering.
- Model card sections and numbered limitations.
- Responsive ledger.

## Explicit exclusions

- Charts that imply precision beyond the counts (ROC curve plots are optional and only with counts shown).

## Implementation guidance

Build tests from contracts/examples/metrics-unavailable.json plus a test-only 'available' snapshot constructed inside the test file (marked as test data).

## Relevant files and modules

- `web/src/pages/EvaluationPage.tsx`
- `web/src/components/ledger/`

## Contract impact

None (MetricsSnapshot, ModelCard).

## Design references

- DESIGN.md §9.11 Metrics table
- DESIGN.md §9.12 Model card
- DESIGN.md §4.2 Ledger tokens

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Test: unavailable snapshot renders 'Metrics unavailable' and no numeric cells.
- [ ] Test: undefined_single_class renders 'Undefined — one class only (n+ = 0)'.
- [ ] Test: partition 'validation' renders 'Validation', never 'Test'.
- [ ] Test: macro AUC line names excluded findings.
- [ ] Scores/AUC never shown as percentages (test).

## Verification

- `pnpm --dir web test`

## Documentation updates

- None

## Definition of done

- Evaluation owner reviewed wording.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
