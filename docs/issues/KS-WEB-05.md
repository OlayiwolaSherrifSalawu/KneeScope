<!-- KS-WEB-05 | generated from docs/issues/src/07-web.toml by scripts/backlog.py; edit the source, not this file -->
# KS-WEB-05: Explanation panel: influential-slice jump and aligned attention overlay

| Field | Value |
|---|---|
| Type | task |
| Priority | P1 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | closed |

## Problem

Reviewers need to jump to influential slices and, if available, see model attention — correctly aligned, correctly named, and absent when unavailable.

## Expected outcome

Explanation panel per DESIGN.md §9.9 and §14: slice chips jump to the series and slice; attention overlay (single-hue ochre→rust ramp with opacity control) drawn only when series, slice, prediction_id and model_version match; 'Explanation unavailable — <reason>' otherwise.

## Dependencies

- Blocked by: `KS-WEB-02` — Slice viewer: canvas rendering, navigation, zoom/pan, display adjust and missing series
- Blocked by: `KS-WEB-03` — Findings panel: run analysis, five finding states and result provenance

- Blocks: `KS-WEB-07` — Accessibility and responsive verification across all pages

## Scope

- Fetch explanation for the selected finding after a prediction.
- Jump switches plane/series as needed.
- Overlay drawing with alignment guard and legend 'Model attention (relative, not lesion location)'.
- Unavailable and alignment-failure states.

## Explicit exclusions

- Rainbow/jet colour maps.
- Wording such as 'tear detected here'.

## Implementation guidance

Fixture explanations provide influential slices only. Test overlay drawing with a test-only AttentionMap built in the test.

## Relevant files and modules

- `web/src/components/explanations/`

## Contract impact

None (Explanation).

## Design references

- DESIGN.md §9.9 Explanation panel
- DESIGN.md §14 Image and overlay presentation

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Test: clicking an influential slice chip for slice_index 12 shows '13 / n' on the correct series.
- [ ] Test: an attention map with a different series_id is not drawn and the panel shows the alignment-failure text.
- [ ] Test: unavailable explanation shows 'Explanation unavailable' and the reason.
- [ ] No string in the component contains 'lesion location' except the negated legend (lint test or grep in CI).

## Verification

- `pnpm --dir web test`

## Documentation updates

- DESIGN.md §9.9 if behaviour changes

## Definition of done

- Labels owner confirmed wording.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
