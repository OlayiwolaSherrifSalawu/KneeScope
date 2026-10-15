<!-- KS-OPT-07 | generated from docs/issues/src/10-optional.toml by scripts/backlog.py; edit the source, not this file -->
# KS-OPT-07: [Optional] Slice thumbnail strip in the viewer

| Field | Value |
|---|---|
| Type | optional |
| Priority | P2 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | optional-ready |

## Problem

A thumbnail strip (as in the reference concept) helps orientation but costs requests and space.

## Expected outcome

Lazy-loaded strip of neighbouring slices under the controls, keyboard accessible, hidden below 900px.

## Dependencies

- Blocked by: `KS-WEB-02` — Slice viewer: canvas rendering, navigation, zoom/pan, display adjust and missing series

- None.

## Scope

- Strip component with lazy loading.

## Explicit exclusions

- Thumbnails of other studies.

## Implementation guidance

Use the same slice endpoint; no new API.

## Relevant files and modules

- `web/src/components/viewer/ThumbnailStrip.tsx`

## Contract impact

None.

## Design references

- DESIGN.md §6 (thumbnail strip optional)
- DESIGN.md §15

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Selecting a thumbnail sets the slice (test).
- [ ] No more than 9 thumbnail requests in flight (test).

## Verification

- `pnpm --dir web test`

## Documentation updates

- DESIGN.md §9.5

## Definition of done

- Screenshots in PR.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
