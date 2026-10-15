<!-- KS-WEB-01 | generated from docs/issues/src/07-web.toml by scripts/backlog.py; edit the source, not this file -->
# KS-WEB-01: Study browser: filter, sort, responsive list and all states

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | closed |

## Problem

The scaffold renders a basic study table. The study browser must match DESIGN.md §9.3 and §15 including filtering, keyboard navigation, the <600px card list, and loading/empty/error states.

## Expected outcome

Studies page complete per DESIGN.md §9.3, §10, §15, §16, working against fixture mode and (later) model mode without changes.

## Dependencies

- None — can start now.

- Blocks: `KS-WEB-07` — Accessibility and responsive verification across all pages

## Scope

- Filter by study ID, sort by ID.
- Rows are links (keyboard Enter), with accessible names including plane availability and analysis status.
- Card list below 600px.
- Loading (flat skeleton, aria-busy), empty (no permitted studies), error (code, request_id, retry).

## Explicit exclusions

- Any metadata beyond DESIGN.md §9.3 (no names, dates, accession numbers).

## Implementation guidance

Reference: docs/design/design-concept.html 'Studies'. Use API types from web/src/api/schema.d.ts only.

## Relevant files and modules

- `web/src/pages/StudiesPage.tsx`
- `web/src/components/`
- `web/src/**/*.test.tsx`

## Contract impact

None (StudyList).

## Design references

- DESIGN.md §9.3 Study table
- DESIGN.md §10 states
- DESIGN.md §15 responsive
- DESIGN.md §16 accessibility

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Component tests: loading, empty (studies: []), error (ApiError body with retryable true shows Retry), and populated states each render the specified text.
- [ ] Missing plane slot has accessible text '<plane> missing' (test).
- [ ] At 375px width there is no horizontal page scroll (manual screenshot in PR).
- [ ] Keyboard: Tab to a row and Enter opens /studies/:id (test).

## Verification

- `pnpm --dir web test`
- `pnpm --dir web build`

## Documentation updates

- DESIGN.md (only if a spec change is needed)

## Definition of done

- Before/after screenshots at 1440px and 375px in the PR.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
