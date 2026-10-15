<!-- KS-OPT-04 | generated from docs/issues/src/10-optional.toml by scripts/backlog.py; edit the source, not this file -->
# KS-OPT-04: [Optional] Exportable research summary

| Field | Value |
|---|---|
| Type | optional |
| Priority | P2 |
| Epic | `KS-EPIC-WEB` |
| Workstream | frontend |
| Recommended owner role | Design/frontend |
| Status (from state.json) | optional-ready |

## Problem

A per-study summary (scores, provenance, versions, revealed labels, limitations) may help reviewers, but must carry all caveats.

## Expected outcome

Printable/Markdown export containing provenance, versions, research-use notice and limitations; no images unless permitted.

## Dependencies

- Blocked by: `KS-WEB-03` — Findings panel: run analysis, five finding states and result provenance
- Blocked by: `KS-WEB-06` — Evaluation and model-card ledger view

- None.

## Scope

- Export view or Markdown download.

## Explicit exclusions

- PDF reports styled like clinical reports.

## Implementation guidance

Must not resemble a radiology report.

## Relevant files and modules

- `web/src/components/export/`

## Contract impact

None.

## Design references

- DESIGN.md §17 prohibited patterns

Interface work must implement the referenced DESIGN.md states exactly; if the spec must change, update DESIGN.md in the same PR.

## Acceptance criteria

- [ ] Export includes source, model version, checkpoint SHA, preprocessing version and the research notice (test).
- [ ] Fixture results export with 'FIXTURE — not a model output' (test).

## Verification

- `pnpm --dir web test`

## Documentation updates

- DESIGN.md

## Definition of done

- QA reviewed wording.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
