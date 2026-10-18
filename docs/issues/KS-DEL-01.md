<!-- KS-DEL-01 | generated from docs/issues/src/09-delivery.toml by scripts/backlog.py; edit the source, not this file -->
# KS-DEL-01: Assemble and submit the final delivery package

| Field | Value |
|---|---|
| Type | task |
| Priority | P0 |
| Epic | `KS-EPIC-DELIVERY` |
| Workstream | delivery |
| Recommended owner role | Coordinator/integrator (human submits) |
| Status (from state.json) | blocked |

## Problem

The organizer requirements (KS-SCOPE-01) define what is submitted. Everything must be consistent: README, model card, metrics, demo, recording, repository state.

## Expected outcome

A checklist in this issue (filled from KS-SCOPE-01) with each deliverable linked; repository tagged; submission performed by a human.

## Dependencies

- Blocked by: `KS-SCOPE-01` — Confirm organizer submission requirements, judging criteria and deadline
- Blocked by: `KS-DOC-01` — Reproducible README: a teammate sets up and runs inference from a clean clone
- Blocked by: `KS-DEMO-03` — Recorded fallback demonstration within data-use terms
- Blocked by: `KS-QA-02` — Independent completion review against the evidence-based definition of done

- None.

## Scope

- Fill checklist.
- Tag release.
- Verify links from a logged-out browser.
- Human submits.

## Explicit exclusions

- Agents do not submit, accept terms, or publish on anyone's behalf.

## Implementation guidance

If any deliverable is missing, say so in the submission rather than substituting.

## Relevant files and modules

- `docs/issue-index.md`
- `README.md`

## Contract impact

None.

## Acceptance criteria

- [ ] Every required deliverable from KS-SCOPE-01 is linked and checked by a second person.
- [ ] git tag exists for the delivered commit.
- [ ] Submission confirmation reference recorded (no credentials).

## Verification

- `git tag --list 'v*'`
- Checklist review in the issue.

## Documentation updates

- docs/issue-index.md

## Definition of done

- Submission confirmed.
- Every acceptance criterion is met and the evidence (test names, command output, screenshots, links) is posted in the issue or PR.
- Verification commands pass locally and in CI where CI covers them.
- Listed documentation is updated in the same PR; DESIGN.md/contracts changes follow AGENTS.md procedures.
- PR reviewed by someone from a different workstream; no restricted data, credentials or large binaries committed.
- docs/issues/state.json and docs/issue-index.md updated (status, links).
