# KneeScope web

React + TypeScript + Vite frontend for the KneeScope knee MRI **research review prototype**
(not a diagnostic tool). This is the app shell: studies list, a minimal review page (viewer,
findings, run analysis, dataset label reveal) and the evaluation ledger. The complete
viewer and findings panel are tracked as later backlog issues.

## Run

```bash
# 1. API in fixture mode (from the repo root, with the API environment installed)
KNEESCOPE_MODE=fixture .venv/bin/uvicorn kneescope_api.main:app --port 8000

# 2. Web (separate terminal)
pnpm --dir web install --frozen-lockfile
pnpm --dir web dev        # http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:8000` and strips the `/api` prefix, so
the browser stays same-origin. Override the proxy target with `KNEESCOPE_API_URL`, or point
the client at another base URL with `VITE_API_BASE_URL` (default `/api`).

In fixture mode the top bar shows a hatched "Fixture mode" chip and every result is labelled
"FIXTURE — not a model output". Slices are synthetic test patterns, not MRI.

## Scripts

| Script                    | What it does                                                      |
| ------------------------- | ----------------------------------------------------------------- |
| `dev` / `build`           | Vite dev server / `tsc -b && vite build`                          |
| `typecheck` / `lint`      | Strict TypeScript / ESLint (flat config, react-hooks)             |
| `format` / `format:check` | Prettier                                                          |
| `test`                    | Vitest + Testing Library; reads `../contracts/examples/*.json`    |
| `gen:api`                 | Regenerate `src/api/schema.d.ts` from `../contracts/openapi.json` |
| `gen:api:check`           | Fail if `schema.d.ts` is stale (CI)                               |

API types are generated, never hand-written. `contracts/openapi.json` and
`contracts/examples/` come from `python scripts/export_contracts.py`.

## Design tokens

[`DESIGN.md`](../DESIGN.md) is canonical. Colour, space, radius and font tokens live in
`src/styles/tokens.css` and are bridged into Tailwind v4 in `src/styles/index.css`
(`@theme inline`; the default palette, radii and shadows are removed). From the repo root,
`python3 scripts/check_design_tokens.py` fails on drift, lost contrast, or any blue/purple hue.
Fonts are bundled through `@fontsource` (no CDN requests).

## Layout

```
src/api/         client.ts (typed fetch, ApiRequestError), schema.d.ts (generated), types.ts
src/components/  AppShell, FindingRow, ProvenanceStrip, MetricsLedger, ...; viewer/ (ViewerPanel, SliceCanvas, PlaneTabs, ...)
src/pages/       StudiesPage, ReviewPage, EvaluationPage
src/hooks/       useAsync, useKeyboardShortcuts
src/styles/      tokens.css, index.css
```
