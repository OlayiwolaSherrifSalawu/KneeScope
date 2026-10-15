<!-- KS-WEB-02 | generated from docs/issues/src/07-web.toml by scripts/backlog.py; edit the source, not this file -->
# KS-WEB-02: Slice viewer: canvas rendering, navigation, zoom/pan, display adjust and missing series

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | closed |

## Problem

The review workspace's viewer must make the image the focus: neutral well, precise slice navigation, zoom/pan/fit, a display-adjust control clearly not called window/level, keyboard shortcuts, and explicit missing-series states.

## Expected outcome

Viewer per DESIGN.md §9.4–9.5, §12, §14: plane tabs (missing plane disabled and skipped), series select, canvas drawing PNGs at rendered size with nearest-neighbour above 200%, slider with aria-valuetext, prefetch of adjacent slices, corner annotations, shortcut sheet.

## Dependencies

- None — can start now.

- Blocks: `KS-WEB-05` — Explanation panel: influential-slice jump and aligned attention overlay
- Blocks: `KS-WEB-07` — Accessibility and responsive verification across all pages
- Blocks: `KS-OPT-07` — [Optional] Slice thumbnail strip in the viewer

## Scope

- Plane tabs with roving tabindex.
- Slice slider, first/prev/next/last, PageUp/PageDown ±10, Home/End, 1/2/3, +/−/0.
- Zoom, pan (drag), fit; display adjust labelled 'Display adjust (not window/level)'.
- Prefetch ±2 slices; show load errors in the well with code.
- Plane switch resets to the middle slice; no cross-plane linking.

## Explicit exclusions

- True window/level (optional KS-OPT-05).
- Crosshairs or linked scrolling between planes.

## Implementation guidance

Slice indices are 0-based in the API; display 1-based. Do not animate between slices.

## Relevant files and modules

- `web/src/components/viewer/`
- `web/src/pages/ReviewPage.tsx`
- `web/src/hooks/useKeyboardShortcuts.ts`

## Contract impact

None (SeriesSummary, slice endpoint).

## Design references

- DESIGN.md §9.4 Plane tabs
- DESIGN.md §9.5 Viewer
- DESIGN.md §12 Keyboard
- DESIGN.md §13 Motion
- DESIGN.md §14 Image presentation

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Tests: pressing j on slice 1 of 30 shows '2 / 30' and requests slice_index 1; End shows '30 / 30'.
- [ ] Missing plane tab has aria-disabled and is skipped by arrow keys and the number shortcut (test).
- [ ] Shortcuts do not fire while focus is in an input/select (test).
- [ ] Display adjust control's accessible name contains 'not window/level' (test).
- [ ] Canvas aria-label includes study, series, plane and slice (test).

## Verification

- `pnpm --dir web test`
- `pnpm --dir web build`

## Documentation updates

- DESIGN.md §12 if bindings change

## Definition of done

- Manual keyboard-only walkthrough recorded in PR.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
