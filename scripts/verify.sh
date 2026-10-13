#!/usr/bin/env bash
# Run every scaffold check. Same steps as CI. Exits non-zero on the first failure.
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n== %s\n' "$*"; }

step "layout";            python3 scripts/check_layout.py
step "design tokens";      python3 scripts/check_design_tokens.py
step "backlog graph";      python3 scripts/backlog.py check
step "docs links";         python3 scripts/check_docs.py
step "ruff";               uv run ruff check . && uv run ruff format --check .
step "mypy";               uv run mypy
step "pytest";             uv run pytest
step "contracts in sync";  uv run python scripts/export_contracts.py --check
step "web install";        pnpm --dir web install --frozen-lockfile
step "web types in sync";  pnpm --dir web gen:api:check
step "web lint";           pnpm --dir web lint
step "web typecheck";      pnpm --dir web typecheck
step "web format";         pnpm --dir web format:check
step "web test";           pnpm --dir web test
step "web build";          pnpm --dir web build
printf '\nall checks passed\n'
