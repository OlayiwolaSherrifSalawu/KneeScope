<!-- KS-OPT-05 | generated from docs/issues/src/10-optional.toml by scripts/backlog.py; edit the source, not this file -->
# KS-OPT-05: [Optional] Server-side true window/level rendering

| Field | Value |
|---|---|
| Type | optional |
| Priority | P2 |
| Epic | `KS-EPIC-API` |
| Workstream | backend |
| Recommended owner role | Backend/serving with Design/frontend |
| Status (from state.json) | optional-ready |

## Problem

Display adjust on PNGs is not MRI window/level. True window/level needs intensity data rendered server-side.

## Expected outcome

Slice endpoint accepts window centre/width in stored-value units and renders accordingly; UI labels it 'Window/level' only when this endpoint is used.

## Dependencies

- Blocked by: `KS-API-01` — Dataset-backed study catalogue and slice rendering in model mode

- None.

## Scope

- Query parameters with validation.
- UI control switch.

## Explicit exclusions

- Client-side raw intensity transfer.

## Implementation guidance

Keep 'Display adjust' as the default.

## Relevant files and modules

- `api/kneescope_api/main.py`
- `ml/kneescope_ml/render.py`
- `web/src/components/viewer/`

## Contract impact

Additive query parameters on the slice endpoint.

## Design references

- DESIGN.md §14

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Rendering with a given window matches a numpy reference (test).
- [ ] UI label switches only when server window/level is active (test).

## Verification

- `pytest tests/api`
- `pnpm --dir web test`

## Documentation updates

- DESIGN.md §14
- contracts/README.md §3

## Definition of done

- Design spec updated.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
