<!-- KS-OPS-01 | generated from docs/issues/src/08-quality.toml by scripts/backlog.py; edit the source, not this file -->
# KS-OPS-01: Restricted-asset protection: data, checkpoints, logs and repository guards

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-QUALITY` |
| Workstream | operations |
| Recommended owner role | Backend/serving with QA reviewer |
| Status (from state.json) | closed |

## Problem

Competition data may not be redistributed, reports may be sensitive, and checkpoints are large. The scaffold ignores data/ and artifacts/, but nothing yet stops a DICOM, report text or a large binary from being committed or logged.

## Expected outcome

A CI and local guard (scripts/check_restricted_assets.py) that fails on DICOM/NIfTI/npz/pt/ckpt files, files over 5 MB, or tracked paths under data/ or artifacts/; API logging that never records request bodies, report text or data paths; documented rules in docs/security.md.

## Dependencies

- None — can start now.

- Blocks: `KS-OPS-05` — [Conditional] Permitted deployment of a hosted demo
- Blocks: `KS-QA-02` — Independent completion review against the evidence-based definition of done
- Blocks: `KS-OPT-01` — [Optional] Upload support for user-supplied studies

## Scope

- Guard script and CI step.
- Logging review of api/ and ml/ for paths and payloads; tests capturing logs.
- docs/security.md: what may be committed, shared, hosted, recorded; incident steps (Kaggle rule: notify on unauthorised access).

## Explicit exclusions

- Authentication, accounts (out of scope).

## Implementation guidance

The repository PDFs are design inputs and allowed. Allow-list explicit exceptions in the script with a reason.

## Relevant files and modules

- `scripts/check_restricted_assets.py`
- `.github/workflows/ci.yml`
- `docs/security.md`
- `tests/test_restricted_assets.py`

## Contract impact

None.

## Acceptance criteria

- [ ] Guard fails on a test repo containing a .dcm file, a 6 MB file, and a file under artifacts/ (test).
- [ ] CI runs the guard on every PR.
- [ ] API test captures logs for a failing prediction and asserts no data root path or request body appears.
- [ ] docs/security.md lists the RSNA data-security obligations with the rules link.

## Verification

- `python scripts/check_restricted_assets.py`
- `pytest tests/test_restricted_assets.py`

## Documentation updates

- docs/security.md
- AGENTS.md (protected assets section link)

## Definition of done

- QA reviewer confirmed CI blocks a seeded violation.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
