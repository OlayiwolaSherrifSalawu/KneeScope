<!-- KS-OPT-02 | generated from docs/issues/src/10-optional.toml by scripts/backlog.py; edit the source, not this file -->
# KS-OPT-02: [Optional] Reviewer notes per study

| Field | Value |
|---|---|
| Type | optional |
| Priority | P2 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | optional-ready |

## Problem

Researchers may want to note observations while reviewing.

## Expected outcome

Local-only notes per study (browser storage), clearly separate from labels and predictions, exportable as text.

## Dependencies

- Blocked by: `KS-WEB-03` — Findings panel: run analysis, five finding states and result provenance

- None.

## Scope

- Notes panel.
- Local storage with try/catch.
- Export.

## Explicit exclusions

- Server-side storage or a database.

## Implementation guidance

Never send notes to the API.

## Relevant files and modules

- `web/src/components/notes/`

## Contract impact

None.

## Design references

- DESIGN.md §9 (add a Notes component spec first)

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Notes persist across reload in the same browser (test with mocked storage).
- [ ] No network request contains note text (test).

## Verification

- `pnpm --dir web test`

## Documentation updates

- DESIGN.md (component spec)

## Definition of done

- Design spec updated.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
