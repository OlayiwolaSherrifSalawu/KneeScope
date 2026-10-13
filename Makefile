# Common commands for the canonical KneeScope layout (docs/decisions.md D-012).
# Requires uv (https://docs.astral.sh/uv/) and pnpm. `make help` lists targets.
.PHONY: help setup setup-ml api web dev test lint format contracts verify up

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

setup: ## Install Python + web deps and the pre-commit hooks
	uv sync && pnpm --dir web install && uv run pre-commit install

setup-ml: ## Also install CPU torch, pydicom, scikit-learn (training/evaluation)
	uv sync --extra ml

api: ## Run the API in fixture mode on :8000
	scripts/dev-api.sh

web: ## Run the web dev server on :5173 (proxies /api to :8000)
	pnpm --dir web dev

dev: ## Run API and web together
	scripts/dev.sh

test: ## Python and web tests
	uv run pytest && pnpm --dir web test

lint: ## Lint, format check and type check
	uv run ruff check . && uv run ruff format --check . && uv run mypy && pnpm --dir web lint && pnpm --dir web typecheck

format: ## Auto-fix lint and formatting
	uv run ruff check --fix . && uv run ruff format . && pnpm --dir web format

contracts: ## Regenerate schemas, OpenAPI, examples and web API types after a contract change
	uv run python scripts/export_contracts.py && pnpm --dir web gen:api

verify: ## Everything CI runs
	scripts/verify.sh

up: ## Build and run the API container (fixture mode by default)
	docker compose up --build
