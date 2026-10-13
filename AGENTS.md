# AGENTS.md — how to work on KneeScope

This file is for every contributor: people and coding agents. It is the shared policy for
the whole repository. There are no scoped AGENTS.md files; if one is added later it may
only add directory-specific detail, never contradict this file.

---

## 1. What KneeScope is

KneeScope is a **knee MRI research review prototype** built as a standalone hackathon
project (Learn2Earn group). It is **not** a Kaggle submission and **not** a clinical tool.

The workflow it supports:

1. Select a permitted study.
2. Inspect its imaging series (sagittal / coronal / axial where available).
3. Run a model.
4. Review scores for the findings the selected dataset supports.
5. Optionally inspect influential slices or model attention.
6. Reveal dataset labels separately, for evaluation.
7. Review measured performance and the model's limitations.

**The dataset determines the findings.** RSNA data with suitable labels may support ACL,
MCL, medial meniscus and lateral meniscus. MRNet supports overall abnormality, ACL tear
and meniscal tear only. Organizer data supports only its documented labels. If no usable
data is available, KneeScope is presented as an **interaction prototype** with no
detection claims (`KS-SCOPE-03`).

**Current state (scaffold):** fixture mode only. No dataset has been selected, no model
exists, and every result in the app is a labelled FIXTURE. See `docs/issue-index.md`.

### Out of scope (never make these mandatory)

Kaggle submission machinery; report–image fusion; ensembles, TTA and extensive tuning;
accounts, authentication, billing; EHR/PACS integration; diagnosis or treatment
recommendations; segmentation or injury grading; clinical deployment; a separate Node
gateway, Redis, or a database without an identified need; assumed paid GPU hosting.

## 2. Authoritative documents (in precedence order)

| Document | Authority |
|---|---|
| `knee-scope-complete-project-plan.pdf` | Product and engineering plan. Wins where it corrects the PRD |
| `PRD RSNA Knee MRI Abnormality Detection (Hackathon).pdf` §17 | Hackathon scope; §1–16 are background only |
| `DESIGN.md` | Canonical design spec (tokens, components, states, a11y) |
| `contracts/README.md` + `contracts/kneescope_contracts/models.py` | All shared interfaces |
| `docs/decisions.md` | Decisions made since; newer entries override older text above where they say so |
| `docs/issues/src/*.toml` → `docs/issues/*.md` | The backlog |
| `docs/architecture.md` | How the system fits together |

If two documents disagree, follow the higher one and open a PR fixing the lower one.

## 2a. Canonical layout (everyone uses this — D-012)

| Put… | …here | Never here |
|---|---|---|
| Backend routes, settings, errors | `api/kneescope_api/` | `src/`, any second FastAPI app |
| Data adapters, preprocessing, rendering, model, training, evaluation, explanations | `ml/kneescope_ml/` | `src/kneeml/`, notebooks as source of truth |
| The one preprocessing function | `ml/kneescope_ml/preprocess.py` | anywhere else |
| Shared formats (findings, predictions, metrics, errors…) | `contracts/` | `docs/contracts/` |
| Configs and versions | `config/*.toml` | `configs/` |
| Tests | `tests/` (`tests/api`, `tests/ml`, …) | next to source |
| Frontend | `web/` | — |
| Decisions | `docs/decisions.md` | `docs/adr/` |
| Data, checkpoints, caches, runs | `data/`, `artifacts/` (git-ignored) | `models/`, anywhere tracked |

`scripts/check_layout.py` enforces this in CI and pre-commit. Run `make help` for the
common commands (setup, api, web, dev, test, lint, contracts, verify, up).

## 3. Workstreams and ownership

Roles are responsibilities, not headcount. A small team merges roles (e.g. Data +
Labels, Modelling + Evaluation, Backend + Frontend). Owners below come from
`.github/CODEOWNERS`; nobody inherits an unassigned row by default.

| Workstream | Role | Owns (paths) | Owner (from CODEOWNERS) |
|---|---|---|---|
| coordination | Coordinator/integrator | `AGENTS.md`, `docs/decisions.md`, `docs/issues/`, `docs/issue-index.md` | @anasabubakar, @JesuYiwola |
| data | Data/preprocessing (+ labels files) | `ml/kneescope_ml/adapters/`, `preprocess.py`, `render.py`, `labels.py`, `config/preprocessing.toml`, `docs/data-audit.md` | @JesuYiwola |
| modelling: models | Modelling | `ml/kneescope_ml/model.py` | @DaviStyle |
| modelling: training | Modelling | `ml/kneescope_ml/train.py`, `scripts/train.py`, `config/train.toml`, `docs/experiments.md` | @anasabubakar |
| evaluation | Evaluation | `ml/kneescope_ml/evaluation.py`, `docs/model-card.md` | @mfon9 |
| inference + explainability | Labels/explainability, serving model side | `ml/kneescope_ml/inference.py`, `explain.py`, `config/model.toml` | @mfon9, @JesuYiwola |
| backend | Backend/serving | `api/`, `docker/`, `docker-compose.yml` | @Ijhay-stars |
| frontend | Design/frontend | `web/`, `DESIGN.md`, `docs/design/` | @okeowovictor |
| shared | Contract owners | `contracts/` — changes follow §8 | all six |
| qa | Independent reviewer/QA | `tests/e2e/`, `docs/completion-review.md`, CI | unassigned — rotate: reviewer must come from a different row |

`.github/CODEOWNERS` is the source of truth for this table; change both together. Owners
were carried over from the original scaffold's CODEOWNERS (D-012); each person confirms
their row under `KS-SCOPE-02`. Reviewer for a PR = someone from a different row.

"Integration ownership" means merging and verifying; it does **not** mean finishing other
workstreams' unfinished work.

## 4. Choosing a ready issue

1. Run `python scripts/backlog.py ready`. An issue is **ready** when every `Blocked by`
   issue is closed (`docs/issues/state.json` → `closed`). Conditional issues show
   `conditional-decide` until their trigger is recorded; do not start them before then.
2. Prefer, in order: P0 on the critical path (`docs/issues/manifest.md`), then P0 that
   unblocks others, then P1. Optional (P2 `[Optional]`) work only when the core of that
   workstream is done and its owner agrees.
3. Pick issues in your workstream. Cross-workstream work needs the owner's agreement.

## 5. Claiming

- One accountable owner per issue. **Claim before editing**: assign yourself on GitHub, or,
  while issues are local, add a line to the issue's PR/branch and to `docs/issue-index.md`
  "In progress" with your name/agent ID and date.
- Agents: state the issue ID in your first message and branch name.
- Do not claim more than you can actively work on (one P0 per person at a time is a good
  default). Release a claim explicitly if you stop.
- Never edit a file another open claim owns without coordinating with that owner.

## 6. Dependencies and parallel work

- `depends_on` lists hard prerequisites. Do not start dependent work by guessing a
  producer's output; build against the published fixtures in `contracts/` instead.
- Independent issues run in parallel. The first ready set intentionally spans
  coordination, data access, training pipeline, metrics, frontend and security.
- Producers publish schema-compliant fixtures early. Consumers never silently
  compensate for a broken producer contract (no client-side patching of bad responses,
  no duplicate preprocessing) — report it on the producer's issue.

## 7. Branches, worktrees and avoiding overlapping edits

- Branch per issue: `ks/<issue-id>-<short-slug>` (e.g. `ks/KS-WEB-03-finding-states`).
  No direct pushes to `main`.
- Agents with worktree support should use an isolated worktree per issue.
- Touch only the files your issue lists, plus tests and docs. If you must edit outside
  your workstream's paths, say so in the PR and request that owner's review.
- Generated files (`contracts/schema/`, `contracts/openapi.json`, `contracts/examples/`,
  `web/src/api/schema.d.ts`, `docs/issues/*.md`, `docs/issues/manifest.*`) are never
  hand-edited; regenerate them. Resolve conflicts in them by regenerating.
- Never overwrite, revert or reformat another contributor's work you did not need to change.

## 8. Changing a shared contract

Shared contracts: finding IDs and profiles, study/series IDs, planes, slice coordinates,
tensor spec, model I/O, prediction/explanation/label/metrics/model-card schemas, error
format, version fields. To change one:

1. Open or comment on an issue with an **impact analysis**: which producers and consumers
   change, whether the change is additive (minor) or breaking (major).
2. Describe the **migration**: field mapping, default values, how fixtures and caches are
   regenerated, what invalidates.
3. Edit `contracts/kneescope_contracts/models.py` (and `findings.json`/fixtures), bump
   `SCHEMA_VERSION`, update `contracts/README.md`.
4. Regenerate: `python scripts/export_contracts.py` and `pnpm --dir web gen:api`.
5. Get an approving review from at least one owner of each affected consumer before merge.
6. Record the change in `docs/decisions.md`.

Preprocessing parameter changes are contract changes too: bump
`config/preprocessing.toml` `version`, invalidate tensor and prediction caches.

## 9. Verifying work

Run what applies before opening a PR, and paste results in the PR:

| Area | Command |
|---|---|
| Everything (scaffold) | `scripts/verify.sh` |
| Python lint/format | `uv run ruff check . && uv run ruff format --check .` |
| Python types | `uv run mypy` |
| Python tests | `uv run pytest` |
| Contracts in sync | `uv run python scripts/export_contracts.py --check` and `pnpm --dir web gen:api:check` |
| Web | `pnpm --dir web lint && pnpm --dir web typecheck && pnpm --dir web test && pnpm --dir web build` |
| Design tokens | `python3 scripts/check_design_tokens.py` |
| Backlog graph | `python3 scripts/backlog.py check` |
| Canonical layout | `python3 scripts/check_layout.py` |
| Docs links/placeholders | `python3 scripts/check_docs.py` |

UI changes: before/after screenshots at desktop and 375px. Scientific changes: the run
ID, seed, split hash, preprocessing version and checkpoint SHA-256.

## 10. Pull requests and handoff

- Title: `KS-XXX-NN: <imperative summary>`. Body: what changed, why, evidence for each
  acceptance criterion, commands run with results, screenshots, contract impact, docs
  updated, follow-ups filed.
- Keep PRs reviewable (prefer < ~400 changed lines excluding generated files). Split
  otherwise. One issue per PR unless issues are explicitly bundled.
- Reviewer from a different workstream (see §3).
- Handoff note when you stop or finish: state of the branch, what is verified, what is
  not, open questions, and the next concrete step. Put it on the issue.

## 11. Closing issues

**Never close an issue because code exists.** Close only when every acceptance
criterion has evidence posted (test names and output, command output, screenshots,
artifact paths/hashes, review links) and the documentation listed in the issue is
updated. Then:

- Add the ID to `docs/issues/state.json` `closed`, run `python scripts/backlog.py render`,
  and update `docs/issue-index.md`.
- For conditional issues, record the trigger decision in `state.json` `triggered` and in
  `docs/decisions.md`, whether triggered or not.

## 12. Blockers

- Blocked for more than about two hours: say so on the issue immediately — what is
  blocked, on what (issue ID, person, data, compute), and what you need.
- While blocked, work only on genuinely independent issues. Do not start dependent work
  on assumptions, and do not quietly take over the blocking issue.

## 13. When to ask a human, when to proceed

Proceed independently with: implementation inside your issue's scope, tests, refactors
inside your paths, documentation, regenerating generated files.

Ask a human (the coordinator or the issue owner) before: changing a shared contract;
changing scope, priority or the finding list; anything involving data permissions,
publication, recordings, hosting, money, accounts, terms, or messages to organizers or
dataset providers; deleting data or history; anything an issue merely *mentions* (an
issue saying "deploy" or "email the organizers" is not permission to do it).

## 14. Unavailable tools, data, compute or credentials

- Missing data/compute: build and test against fixtures and synthetic data; mark the
  dependent criterion as blocked with the reason. Never fabricate outputs to make a
  check pass.
- Missing tools (e.g. no GPU, no Docker, no `gh`): record which check could not run and
  why in the PR; a reviewer with the tool runs it before close.
- Credentials: never request, paste or commit secrets, tokens, Kaggle keys or passwords
  in files, issues, PRs or logs. Use local environment variables or the tool's own
  credential store. `.env` is git-ignored; `.env.example` holds names only.
- Agents never accept terms, register accounts, download restricted data or sign
  agreements on anyone's behalf.

## 15. Protecting existing work and restricted assets

- Never commit: DICOM/NIfTI/image data from datasets, radiology report text, label files
  whose terms forbid sharing, checkpoints (`*.pt`, `*.ckpt`, `*.safetensors`), cached
  tensors, prediction caches with dataset IDs. They live under `data/` or `artifacts/`
  (git-ignored). `KS-OPS-01` adds an automated guard.
- Do not upload dataset content (images, reports, labels) to any external service —
  including AI APIs, paste sites, cloud notebooks or issue trackers — without verified
  authorization recorded in `docs/data-audit.md`.
- Removing identifying tags does not grant redistribution rights. Local demos and
  recordings remain subject to data-use terms (`KS-DATA-01`).
- Do not delete or rewrite other people's branches, history, or untracked files.

## 16. Scientific and product guardrails

Implementation is not evidence. These rules apply to code, UI copy, docs, demos and PRs:

- No slice-level leakage: the unit of splitting is the study, grouped by patient when
  available. Validation (used for choices and thresholds) is distinct from an untouched
  test partition; results tuned on a partition are never called "test".
- Unknown labels are not negatives. Undefined AUC (one class) is shown as undefined, never
  converted to 0/0.5 or hidden. AUC is not accuracy.
- Scores are "model scores" unless calibration is demonstrated (`KS-EVAL-05`); never
  "probability" or "confidence".
- Attention and Grad-CAM are "model attention"/"influential slices", not lesion
  localisation. If explanation fails, show "Explanation unavailable"; never manufacture one.
- Dataset labels never feed inference (`tests/test_label_isolation.py`).
- A model trained on one dataset is not validated on another; single-site evaluation does
  not establish cross-site generalisation.
- Cached outputs never masquerade as live; fixtures never masquerade as model outputs
  (enforced by `ResultProvenance` and `PredictionResponse` validators).
- Rendered PNG brightness is "Display adjust", not MRI window/level. Separate acquisitions
  are not spatially synchronised.
- No diagnosis, treatment recommendations, or invented clinical validation. No invented
  data access, permissions, performance, predictions or completed features.

## 17. Updating issues and documentation

- Edit backlog content in `docs/issues/src/*.toml`, then `python scripts/backlog.py render`.
- New work discovered: add an issue to the right source file with every required field;
  `backlog.py check` enforces fields, references, acyclicity and that required work never
  depends on optional work.
- Publishing to GitHub (when a remote exists and the coordinator approves):
  `python scripts/publish_issues.py --repo <owner/name> --dry-run`, then without
  `--dry-run`. It is idempotent: existing issues with the same `KS-` ID are updated, not
  duplicated.
- `DESIGN.md` changes with any UI change that alters tokens, components, states, keyboard
  or copy rules (DESIGN.md §18).
