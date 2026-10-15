<!-- KS-WEB-04 | generated from docs/issues/src/07-web.toml by scripts/backlog.py; edit the source, not this file -->
# KS-WEB-04: Reveal dataset label per finding, separate from inference

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | closed |

## Problem

Comparing a score with the dataset label is part of the workflow, but labels must be hidden by default and fetched separately so they cannot influence or be confused with predictions.

## Expected outcome

Per-finding 'Reveal dataset label' action per DESIGN.md §9.10 fetching /studies/{id}/labels on demand, showing state and provenance, reset on study change.

## Dependencies

- None — can start now.

- Blocks: `KS-WEB-07` — Accessibility and responsive verification across all pages

## Scope

- Lazy fetch on first reveal.
- States positive/negative/unknown (not labelled)/not_labeled text.
- Provenance text including 'fixture' when applicable.
- Reset on study change.

## Explicit exclusions

- Any aggregation of labels vs scores in the review view (that is the evaluation page).

## Implementation guidance

Never send labels to POST /predictions or store them with predictions in client state.

## Relevant files and modules

- `web/src/components/findings/LabelReveal.tsx`

## Contract impact

None (StudyLabels).

## Design references

- DESIGN.md §9.10 Dataset label reveal

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Test: no /labels request is made until the first reveal click.
- [ ] Test: switching study hides revealed labels.
- [ ] Test: 'unknown' renders 'Unknown (not labelled)', never 'Negative'.
- [ ] Test: the predictions request body never contains label fields.

## Verification

- `pnpm --dir web test`

## Documentation updates

- None

## Definition of done

- Reviewed by the Labels owner.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
