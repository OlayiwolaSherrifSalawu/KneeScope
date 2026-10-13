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

## D-011 — 2026-10-13 — Merge the original main scaffold without removing it
- **Decision:** `main` (the team's original scaffold: `src/knee_api`, `src/kneeml`,
  `docs/contracts/01–07`, Docker, Makefile, pre-commit, CODEOWNERS) was merged into
  `anasabubakar/kneescope-foundation` with both histories kept and nothing deleted, so the
  foundation can be proposed to `main` as a PR. Authorised by Anas Abubakar.
- **Conflicts resolved:** `.gitignore` and `.env.example` are unions; README keeps the
  KneeScope text and describes both scaffolds; `pyproject.toml` packages both layouts,
  adds the original dependencies (`pydantic-settings`; `SimpleITK`, `pandas`, `pyyaml` in
  the `ml` extra) and a `dev` extra so `pip install -e ".[dev]"` in the Makefile still works;
  `ci.yml` is the KneeScope workflow (it also runs the original tests); `web.yml` reads the
  pnpm version from `web/package.json` instead of pinning pnpm 9. The original lint
  settings stay in force for the original code via `ruff.toml` files in `src/`,
  `tests/knee_api/` and `tests/kneeml/`. `data/` and `artifacts/` ignores are now
  root-anchored so `src/kneeml/data/` is not ignored.
- **Open:** `.github/CODEOWNERS` assigns data → JesuYiwola, models → DaviStyle, training →
  anasabubakar, eval → mfon9, inference → mfon9 + JesuYiwola, API → Ijhay-stars, web →
  okeowovictor. The two layouts overlap (two APIs, two ML packages, two contract
  folders). The owners should choose one layout per area and retire the other; record it
  here. This also feeds KS-SCOPE-02.

## D-012 — 2026-10-13 — One canonical layout for everyone
- **Decision:** The KneeScope layout is canonical: `api/` (backend), `ml/` (data,
  preprocessing, model, training, evaluation, inference), `contracts/` (shared formats),
  `config/` (TOML configs), `tests/`, `web/`, `docs/decisions.md`. The original scaffold's
  `src/knee_api`, `src/kneeml`, `docs/contracts/`, `configs/`, `docs/adr/`, `models/`,
  `scaffold.sh` and duplicate `web.yml` are retired (recoverable from git history).
  Decided by Anas Abubakar on the team's behalf.
- **Why:** Two APIs, two ML packages and two contract folders cannot coexist: the plan
  requires one shared preprocessing implementation and one API the web app talks to. The
  KneeScope side holds the filled-in contracts and tested code; the original side was stubs
  (placeholder hash-based scores, a one-line z-score, empty contract templates).
- **Carried over:** CODEOWNERS (same people, remapped paths), `/readyz`, honouring a
  client `X-Request-ID`, Makefile targets, Docker + compose (now localhost-only, mounting
  `artifacts/`), pre-commit hooks (ruff now runs from the locked env). Baseline hints from
  `configs/baseline.yaml` for KS-MODEL-03 to evaluate: seed 42, subset 800 studies,
  224 px input, `efficientnet_b0` backbone, 10 epochs, batch 16, lr 3e-4.
- **Enforcement:** `scripts/check_layout.py` (CI + pre-commit) fails on retired paths, a
  preprocessing function outside `ml/kneescope_ml/preprocess.py`, or a FastAPI app
  outside `api/`. AGENTS.md §2a lists where everything goes.
- **Supersedes:** the "Open" part of D-011.

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
