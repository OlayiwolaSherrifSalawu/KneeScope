# Decision log

Short entries, newest last. Each: ID, date, decision, why, consequences, who. Later
entries may supersede earlier ones explicitly. Decisions still open are listed at the end.

## D-001 — 2026-10-13 — Scope follows the project plan and PRD §17
- **Decision:** The standalone hackathon scope in the project plan (and PRD §17 where the
  plan does not correct it) is authoritative. PRD §1–16 are background.
- **Why:** PRD §17 supersedes the Kaggle requirements; the plan narrows and corrects it.
- **Consequences:** No Kaggle submission, fusion, ensembles, async jobs by default, or
  accounts. Excluded features are listed in AGENTS.md §1 and never become mandatory.
- **By:** Scaffold (agent), pending team confirmation in KS-SCOPE-02.

## D-002 — 2026-10-13 — Design direction "Lightbox & Ledger"
- **Decision:** Dark warm-charcoal workspace with a neutral viewer well; evidence pages as
  bone-paper ledger documents; olive interaction accent; no blue/teal/purple, gradients
  or glow. Supersedes the plan's "restrained teal accents".
- **Why:** Best imaging readability and hierarchy of three explored directions
  (docs/design/design-concept.md); the brief excludes blue-family accents.
- **Consequences:** Tokens in DESIGN.md §4, enforced by scripts/check_design_tokens.py.

## D-003 — 2026-10-13 — Pydantic models are the single contract source
- **Decision:** `contracts/kneescope_contracts/models.py` is canonical; JSON Schema,
  OpenAPI, examples and TypeScript types are generated and drift-checked in CI.
- **Why:** One place to change; validators encode rules (provenance, finding states,
  undefined AUC) that plain schemas cannot.

## D-004 — 2026-10-13 — Fixture mode and the interaction_prototype profile are the default
- **Decision:** Until KS-DATA-04, the API runs in fixture mode with the
  `interaction_prototype` profile; fixture results are always `source: fixture` from
  `fixture-model` with no checkpoint, and fixture metrics are always `unavailable`.
- **Why:** Frontend work must not wait for a model, and fixtures must never look like results.

## D-005 — 2026-10-13 — Finding states and study-level failures
- **Decision:** Five finding states (scored, not_evaluated, unavailable, unsupported,
  failed). A study that cannot be preprocessed returns HTTP 422 with no partial scores; a
  missing required plane makes findings `unavailable`; per-finding errors are `failed`.
- **Why:** Low scores, missing inputs, unsupported findings and errors must be distinguishable.

## D-006 — 2026-10-13 — Synchronous inference first
- **Decision:** `POST /predictions` is synchronous. Job-and-poll is added only if
  KS-OPS-03 measures p95 above the request timeout (KS-OPS-04).

## D-007 — 2026-10-13 — Restricted assets stay out of git
- **Decision:** `data/` and `artifacts/` are git-ignored; checkpoints, caches, manifests
  with dataset IDs, labels with restricted terms and report text are never committed.
- **Why:** RSNA rules forbid making Competition Data available to non-participants;
  checkpoints are large.

## D-008 — 2026-10-13 — Local repository and local backlog
- **Decision:** The project directory was initialised as its own git repository (no
  remote, no commits made by the scaffold). The enclosing `~/Desktop` repository does not
  track it. The backlog lives in `docs/issues/` with an idempotent publisher; nothing was
  published to GitHub.
- **Why:** No GitHub remote exists for KneeScope; creating one requires authorization.

## D-009 — 2026-10-13 — Python 3.12+ with uv; Node 24 with pnpm
- **Decision:** `uv` (lockfile `uv.lock`) for Python, `pnpm` (`pnpm-lock.yaml`) for web.
  Heavy ML dependencies (torch, pydicom, scikit-learn) live in the `ml` extra so fixture
  mode and CI stay light.

## D-010 — 2026-10-13 — CPU-only PyTorch wheels in the lockfile
- **Decision:** `torch`/`torchvision` resolve from the PyTorch CPU index
  (`[tool.uv.sources]` in `pyproject.toml`). Training on a hosted GPU platform uses that
  platform's own torch build; record its version in the run metadata.
- **Why:** No GPU subscription is assumed; default Linux wheels pull several GB of CUDA
  libraries, which is impractical for local setup, CI and the container.
- **Consequences:** `uv sync --extra ml` works on any CPU machine; the `ml` CI job runs the
  training smoke tests.

## Open decisions

| Decision | Evidence required | Issue |
|---|---|---|
| Dataset and permitted uses | Access and applicable training, hosting, demo and recording terms | KS-DATA-01, KS-DATA-02, KS-DATA-04 |
| Supported finding list | Audited label counts and provenance | KS-DATA-03, KS-DATA-04 |
| Evaluation partition | Patient grouping availability; label counts per partition | KS-DATA-08 |
| Report-label extraction | Labelled subset size vs need | KS-DATA-04 → KS-LABEL-02 |
| Serving mode | Measured latency vs request limit | KS-OPS-03 |
| Named owners | Team agreement | KS-SCOPE-02 |
| Submission expectations | Organizer requirements | KS-SCOPE-01 |
| Hosting | Organizer requirement and data terms | KS-OPS-05 |
