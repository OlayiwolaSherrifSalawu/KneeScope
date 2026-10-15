<!-- KS-WEB-03 | generated from docs/issues/src/07-web.toml by scripts/backlog.py; edit the source, not this file -->
# KS-WEB-03: Findings panel: run analysis, five finding states and result provenance

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | closed |

## Problem

Reviewers must be able to tell scored, not evaluated, unavailable, unsupported and failed apart, and live, cached and fixture results apart, without relying on colour.

## Expected outcome

Findings column per DESIGN.md §9.6–9.8 and §11: run-analysis button with step/elapsed status and aria-live announcements; finding rows driven by the active profile; provenance strip with LIVE/CACHED/FIXTURE treatments; study-level errors as 'Analysis failed' with code and request_id.

## Dependencies

- None — can start now.

- Blocks: `KS-WEB-05` — Explanation panel: influential-slice jump and aligned attention overlay
- Blocks: `KS-WEB-07` — Accessibility and responsive verification across all pages
- Blocks: `KS-QA-01` — End-to-end integration tests for fixture and model modes
- Blocks: `KS-OPT-02` — [Optional] Reviewer notes per study
- Blocks: `KS-OPT-04` — [Optional] Exportable research summary

## Scope

- Run analysis with disabled state while running and 'Run again' after.
- All five states with glyph + text; score bar never coloured by value.
- Threshold text only when threshold exists.
- Provenance strip fields: source badge, model version, checkpoint short SHA, preprocessing version, computed/served time, latency for live only.
- Fixture hatch stripe on rows and viewer frame.

## Explicit exclusions

- Explanation panel (KS-WEB-05).
- Label reveal (KS-WEB-04).

## Implementation guidance

Drive tests from contracts/examples/*.json. For cached and live states, construct test-only responses inside tests (validated shapes), never ship them as fixtures.

## Relevant files and modules

- `web/src/components/findings/`
- `web/src/pages/ReviewPage.tsx`

## Contract impact

None (PredictionResponse).

## Design references

- DESIGN.md §9.6 Run analysis
- DESIGN.md §9.7 Provenance strip
- DESIGN.md §9.8 Finding row
- DESIGN.md §11 Result and finding states

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Test: a score of 0.07 renders as scored ('0.07'), with no 'failed' or 'unavailable' text.
- [ ] Test: each status renders its distinct text ('Not evaluated', 'Unavailable — …', 'Not supported by this model', 'Analysis failed — <code>').
- [ ] Test: fixture response shows 'FIXTURE — not a model output'; cached shows 'CACHED' with the original timestamp and no latency; live shows 'LIVE' with latency.
- [ ] Test: HTTP 422 PREPROCESSING_FAILED shows 'Analysis failed' and no scores.
- [ ] aria-live region announces start and completion (test).

## Verification

- `pnpm --dir web test`

## Documentation updates

- DESIGN.md §11 if states change

## Definition of done

- Screenshots of all five states in the PR.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
