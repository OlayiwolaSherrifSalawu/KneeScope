<!-- KS-WEB-07 | generated from docs/issues/src/07-web.toml by scripts/backlog.py; edit the source, not this file -->
# KS-WEB-07: Accessibility and responsive verification across all pages

| Field | Value |
|---|---|
| Type | task |
| Priority | P1 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend with QA reviewer |
| Status (from state.json) | ready |

## Problem

Accessibility and responsiveness regress easily when features land separately.

## Expected outcome

Automated axe checks for every page state in component tests, a manual keyboard and screen-reader pass, reduced-motion and 200% zoom checks, and screenshots at 1440, 1024, 768 and 375 px.

## Dependencies

- Blocked by: `KS-WEB-01` — Study browser: filter, sort, responsive list and all states
- Blocked by: `KS-WEB-02` — Slice viewer: canvas rendering, navigation, zoom/pan, display adjust and missing series
- Blocked by: `KS-WEB-03` — Findings panel: run analysis, five finding states and result provenance
- Blocked by: `KS-WEB-04` — Reveal dataset label per finding, separate from inference
- Blocked by: `KS-WEB-05` — Explanation panel: influential-slice jump and aligned attention overlay
- Blocked by: `KS-WEB-06` — Evaluation and model-card ledger view

- Blocks: `KS-DEMO-02` — Demo script and rehearsal
- Blocks: `KS-QA-02` — Independent completion review against the evidence-based definition of done

## Scope

- Add vitest-axe (or jest-axe) checks.
- Manual checklist in docs/accessibility.md with results.
- Fix violations or file follow-ups with severity.

## Explicit exclusions

- WCAG AAA.

## Implementation guidance

Contrast tokens are verified by scripts/check_design_tokens.py; component-level contrast (e.g. text on hatch) still needs manual checks.

## Relevant files and modules

- `web/src/**/*.test.tsx`
- `docs/accessibility.md`

## Contract impact

None.

## Design references

- DESIGN.md §15 Responsive
- DESIGN.md §16 Accessibility
- DESIGN.md §13 Motion

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] axe reports zero serious/critical violations for Studies, Review (each finding state), Evaluation (available and unavailable).
- [ ] docs/accessibility.md records keyboard-only completion of the full workflow and screen-reader announcement of analysis completion.
- [ ] No horizontal page scroll at 375px on any page (screenshots).
- [ ] With prefers-reduced-motion, no CSS transitions run (test or manual check recorded).

## Verification

- `pnpm --dir web test`
- `python3 scripts/check_design_tokens.py`

## Documentation updates

- docs/accessibility.md
- DESIGN.md if rules change

## Definition of done

- QA reviewer signs the checklist.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
