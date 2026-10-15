# KneeScope API reference for the frontend UI

Everything the web app needs to talk to the backend: how to reach it, the conventions every
response follows, all eleven endpoints with request/response examples and error codes, and
which component calls what. The UI never hard-codes findings, scores or labels — it renders
what these endpoints return.

Sources of truth (regenerate, never hand-edit):

| Artifact | Contents |
|---|---|
| [`contracts/openapi.json`](../contracts/openapi.json) | Generated OpenAPI document of this API |
| [`contracts/schema/*.schema.json`](../contracts/schema) | JSON Schema per response/request model |
| [`web/src/api/schema.d.ts`](../web/src/api/schema.d.ts) | Generated TypeScript types (`pnpm --dir web gen:api`) |
| [`contracts/README.md`](../contracts/README.md) | Field-level contract rules (§1–§11) |
| [`api/kneescope_api/main.py`](../api/kneescope_api/main.py) | The routes themselves |

---

## 1. Reaching the API

| Item | Value |
|---|---|
| API base (direct) | `http://localhost:8000` — `make api` (fixture mode) |
| Web dev server | `http://localhost:5173` — `make web` (Vite) |
| Browser base URL | `/api` by default: Vite proxies `/api/*` to `KNEESCOPE_API_URL` (default `http://localhost:8000`) and strips the prefix, so the browser stays same-origin |
| Override | `VITE_API_BASE_URL` (see [`web/src/api/client.ts`](../web/src/api/client.ts) `apiBaseUrl()`) |
| Run both | `make dev` or `make up` (container) |
| Interactive API docs | `http://localhost:8000/docs` (FastAPI Swagger UI) |

Run modes ([`api/kneescope_api/settings.py`](../api/kneescope_api/settings.py), names in
[`.env.example`](../.env.example)):

| Mode | `KNEESCOPE_MODE` | Studies | Predictions / labels / metrics |
|---|---|---|---|
| Fixture (default, now) | `fixture` | `contracts/fixtures/studies.json` | Fixture results, marked `FIXTURE` |
| Model (partial) | `model` | Manifest via `KNEESCOPE_MANIFEST` + `KNEESCOPE_DATA_ROOT` | `503 MODEL_NOT_LOADED` until KS-API-02/05 — the UI must render that as an error, never as data |

## 2. Conventions every endpoint follows

- **JSON in, JSON out** except the slice endpoint (PNG). Bodies are contract models with
  `extra="forbid"`: unexpected fields are rejected with `422 VALIDATION_ERROR`.
- **IDs** (`study_id`, `series_id`, `finding_id` path segments) match
  `^[A-Za-z0-9._-]{1,128}$`. Anything else fails validation before reaching a handler.
- **`slice_index` is 0-based**; the UI displays `slice_index + 1`.
- **Errors**: every non-2xx JSON body is an `ApiError` —
  `{"error": {"code", "message", "request_id", "retryable", "detail"}}`. Messages are safe
  to show to a reviewer (no paths, stack traces or report text). The `X-Request-ID`
  response header matches `error.request_id`; a well-formed `X-Request-ID` request header
  (`[A-Za-z0-9._-]{1,64}`) is honoured.
- **CORS**: only `KNEESCOPE_CORS_ORIGINS` (default `http://localhost:5173`); methods
  `GET`, `POST`; request header `Content-Type`; exposed header `X-Request-ID`.
- **No authentication.** The API binds to localhost and must not be exposed publicly with
  restricted data ([`docs/security.md`](security.md)).
- **Versions** appear inside payloads: contract `SCHEMA_VERSION`, `preprocessing.version`,
  `model.model_version`, finding profile id. Compare them rather than assuming them.

## 3. Endpoint map at a glance

| # | Method & path | Response model | Called by (UI) |
|---|---|---|---|
| 1 | `GET /healthz` | `Health` | `api.health()` in the client; ready for a status banner |
| 2 | `GET /readyz` | `Health` | probes/liveness checks |
| 3 | `GET /findings` | `FindingProfile` | [`ReviewPage.tsx`](../web/src/pages/ReviewPage.tsx) — finding rows |
| 4 | `GET /studies` | `StudyList` | [`StudiesPage.tsx`](../web/src/pages/StudiesPage.tsx) |
| 5 | `GET /studies/{study_id}` | `StudyDetail` | `ReviewPage` — viewer + series |
| 6 | `GET /studies/{study_id}/series/{series_id}/slices/{index}` | `image/png` | [`SliceCanvas.tsx`](../web/src/components/viewer/SliceCanvas.tsx) via `sliceUrl()` |
| 7 | `POST /predictions` | `PredictionResponse` | [`useAnalysis.ts`](../web/src/components/findings/useAnalysis.ts) — "Run analysis" (`r` shortcut) |
| 8 | `GET /studies/{study_id}/explanations/{finding_id}?prediction_id=…` | `Explanation` | [`useExplanation.ts`](../web/src/components/explanations/useExplanation.ts) |
| 9 | `GET /studies/{study_id}/labels` | `StudyLabels` | [`useLabelReveal.ts`](../web/src/components/findings/useLabelReveal.ts) — "Reveal dataset label" |
| 10 | `GET /metrics` | `MetricsSnapshot` | [`EvaluationPage.tsx`](../web/src/pages/EvaluationPage.tsx) |
| 11 | `GET /model-card` | `ModelCard` | `EvaluationPage` |

## 4. UI routes and their request flow

| Route | Page | Requests (in order) |
|---|---|---|
| `/` | [`StudiesPage`](../web/src/pages/StudiesPage.tsx) | `GET /studies` |
| `/studies/:studyId` | [`ReviewPage`](../web/src/pages/ReviewPage.tsx) | `GET /studies/{id}` + `GET /findings`, then slice PNGs as the viewer scrolls; on **Run analysis** → `POST /predictions`; on finding selection with `explanation_available` → `GET …/explanations/{finding}`; on first label reveal → `GET …/labels` |
| `/evaluation` | [`EvaluationPage`](../web/src/pages/EvaluationPage.tsx) | `GET /metrics` + `GET /model-card` |

Loading/empty/error states the UI must cover (see [`DESIGN.md`](../DESIGN.md)):

- **Loading**: `useAsync` phase `loading` → skeletons (studies) or a status line.
- **Error**: any rejected request → [`ErrorPanel`](../web/src/components/ErrorPanel.tsx)
  with the `ApiError` code, message and a Retry button when `retryable` (or
  `API_UNREACHABLE`).
- **Empty**: `studies: []` → "No permitted studies"; a filter with no matches → clear action.
- **Fixture provenance**: `study.origin === 'fixture'` or `provenance.source === 'fixture'`
  drives the fixture stripe and the announcement "Fixture result, not a model output."
- **Not run**: findings show per-status reasons until an analysis completes; the
  explanation panel explains why nothing is shown.

---

## 5. Endpoint reference

### 5.1 `GET /healthz` → `Health`

Liveness plus runtime identity. No parameters.

```bash
curl -s http://localhost:8000/healthz
```

```json
{
  "status": "ok",
  "api_version": "0.1.0",
  "schema_version": "0.1.0",
  "mode": "fixture",
  "model_loaded": false,
  "model_version": null,
  "preprocessing_version": "prep-0.0.0-placeholder",
  "finding_profile": "interaction_prototype"
}
```

### 5.2 `GET /readyz` → `Health`

Same body as `/healthz`, but first loads the study catalogue; a catalogue that cannot load
returns `500 INTERNAL_ERROR`. Use for readiness probes, not for page rendering.

### 5.3 `GET /findings` → `FindingProfile`

The active finding list. The UI renders exactly this — it never hard-codes findings.

```bash
curl -s http://localhost:8000/findings
```

```json
{
  "profile_id": "interaction_prototype",
  "dataset_id": null,
  "status": "fixture_only",
  "note": "No usable training data. The product is an interaction prototype; every result is a fixture and no detection claim is made.",
  "findings": [
    { "finding_id": "acl", "display_name": "ACL", "description": "Anterior cruciate ligament injury (RSNA label 'ACL')." },
    { "finding_id": "mcl", "display_name": "MCL", "description": "Medial collateral ligament injury (RSNA label 'MCL')." },
    { "finding_id": "medial_meniscus", "display_name": "Medial meniscus", "description": "Medial meniscus tear (RSNA label 'Medial Meniscus')." },
    { "finding_id": "lateral_meniscus", "display_name": "Lateral meniscus", "description": "Lateral meniscus tear (RSNA label 'Lateral Meniscus')." }
  ]
}
```

Profiles: `interaction_prototype` (default, fixture only), `rsna4`, `mrnet3`
(`KNEESCOPE_FINDING_PROFILE`). Status is `candidate | selected | fixture_only`.

### 5.4 `GET /studies` → `StudyList`

```bash
curl -s http://localhost:8000/studies
```

```json
{
  "origin_notice": "FIXTURE - synthetic development studies, not dataset studies.",
  "studies": [
    {
      "study_id": "fx-study-001",
      "display_label": "Fixture study 001",
      "origin": "fixture",
      "dataset_id": null,
      "planes_available": ["sagittal", "coronal", "axial"],
      "series_count": 4,
      "analysis_status": "not_run"
    }
  ]
}
```

- `origin_notice` is shown under the table — surface it, do not discard it.
- `analysis_status`: `not_run | cached | failed` (client-side hint per study).
- Errors: `500 INTERNAL_ERROR` when the study catalogue cannot load.

### 5.5 `GET /studies/{study_id}` → `StudyDetail`

Everything the viewer needs: summary fields plus `series`, `missing_planes`, `warnings`.

```bash
curl -s http://localhost:8000/studies/fx-study-001
```

```json
{
  "study_id": "fx-study-001",
  "display_label": "Fixture study 001",
  "origin": "fixture",
  "dataset_id": null,
  "planes_available": ["sagittal", "coronal", "axial"],
  "series_count": 4,
  "analysis_status": "not_run",
  "missing_planes": [],
  "warnings": [],
  "series": [
    {
      "series_id": "fx-ser-01",
      "plane": "sagittal",
      "description": "Sag PD FS (fixture)",
      "num_slices": 30,
      "slice_order": "synthetic",
      "fluid_sensitive": true,
      "fat_suppressed": true,
      "rendered_width": 256,
      "rendered_height": 256
    }
  ]
}
```

- `plane` may be `null` (undetermined): such series are listed but never model input.
- `rendered_width/height` are exactly the PNG dimensions from §5.6 — use them for canvas
  sizing and for `rendered_slice_pixels` overlay coordinates.
- Errors: `404 STUDY_NOT_FOUND`, `422 VALIDATION_ERROR` (`study_id` outside
  `^[A-Za-z0-9._-]{1,128}$`), `500 INTERNAL_ERROR`.

### 5.6 `GET /studies/{study_id}/series/{series_id}/slices/{index}` → `image/png`

8-bit grayscale PNG of one slice, `rendered_width × rendered_height`.

```bash
curl -s -o slice.png http://localhost:8000/studies/fx-study-001/series/fx-ser-01/slices/12
```

- Headers: `Cache-Control: private, max-age=3600`, `X-KneeScope-Origin: fixture|dataset`.
- Rendering is a display mapping (percentile scaling) — the UI labels it **Display
  adjust**, never MRI window/level.
- Errors: `404 STUDY_NOT_FOUND`, `404 SERIES_NOT_FOUND`, `404 SLICE_OUT_OF_RANGE`
  (`slice_index must be 0..n-1`), `422 PREPROCESSING_FAILED`, `422 INPUT_INVALID`.
- `<img>` elements expose no status code, so the client re-fetches the URL on error to read
  the `ApiError` body: `diagnoseSliceFailure(url)` in
  [`web/src/api/client.ts`](../web/src/api/client.ts).

### 5.7 `POST /predictions` → `PredictionResponse`

Runs (or serves a cached) analysis. Labels are never part of this request or response.

**Request**

```json
{
  "study_id": "fx-study-001",
  "findings": null,
  "allow_cached": true
}
```

| Field | Type | Meaning |
|---|---|---|
| `study_id` | string, required | Study to analyse |
| `findings` | `string[] \| null` | Subset of the active profile; `null` = all |
| `allow_cached` | bool (default `true`) | Serve a matching cached result instead of running live |

```bash
curl -s -X POST http://localhost:8000/predictions \
  -H 'Content-Type: application/json' \
  -d '{"study_id": "fx-study-001", "allow_cached": true}'
```

**Response** (fixture example, abbreviated — full copy in
[`contracts/examples/prediction-fixture.json`](../contracts/examples/prediction-fixture.json)):

```json
{
  "schema_version": "0.1.0",
  "prediction_id": "fx-pred-fx-study-001-interaction_prototype",
  "study_id": "fx-study-001",
  "provenance": {
    "source": "fixture",
    "computed_at": null,
    "served_at": "2026-10-15T12:00:00Z",
    "latency_ms": null,
    "cache_key": null,
    "notice": "FIXTURE - hand-written development data, not a model output."
  },
  "model": {
    "model_id": "fixture-model",
    "model_version": "fixture-0",
    "checkpoint_sha256": null,
    "finding_profile": "interaction_prototype",
    "supported_findings": ["acl", "mcl", "medial_meniscus"],
    "trained_on": null
  },
  "preprocessing": { "version": "prep-0.0.0-placeholder", "config_sha256": "0c68…" },
  "findings": [
    { "finding_id": "acl", "display_name": "ACL", "status": "scored", "score": 0.71,
      "score_kind": "uncalibrated_model_score", "threshold": null, "above_threshold": null,
      "reason": null, "explanation_available": true },
    { "finding_id": "medial_meniscus", "display_name": "Medial meniscus", "status": "failed",
      "score": null, "score_kind": null, "threshold": null, "above_threshold": null,
      "explanation_available": false,
      "reason": { "code": "INFERENCE_FAILED", "message": "Fixture: inference for this finding failed." } },
    { "finding_id": "lateral_meniscus", "display_name": "Lateral meniscus", "status": "unsupported",
      "score": null, "score_kind": null, "threshold": null, "above_threshold": null,
      "explanation_available": false,
      "reason": { "code": "NOT_SUPPORTED", "message": "Not supported by this model." } }
  ],
  "inputs": [
    { "plane": "sagittal", "series_id": "fx-ser-01", "slices_used": 30 },
    { "plane": "coronal", "series_id": "fx-ser-02", "slices_used": 28 },
    { "plane": "axial", "series_id": "fx-ser-03", "slices_used": 32 }
  ],
  "missing_planes": [],
  "warnings": [{ "code": "FIXTURE", "message": "FIXTURE - hand-written development data, not a model output." }]
}
```

**Per-finding `status` rules the UI must respect**

| `status` | Score fields | UI meaning |
|---|---|---|
| `scored` | `score ∈ [0,1]` + `score_kind` always present | Show the model score; a low score (e.g. `0.03`) is still `scored` |
| `not_evaluated` | all `null` | Analysis not run or finding not requested |
| `unavailable` | all `null`, `reason` set | Required input missing (e.g. a missing plane) |
| `unsupported` | all `null`, `reason` set | In the profile but not predicted by this model |
| `failed` | all `null`, `reason` set | Inference error for this finding only |

`threshold` and `above_threshold` appear **together**, only when a validated threshold
exists; `above_threshold == (score >= threshold)`.

**Provenance (`provenance.source`)** — never relabel:

- `live`: computed now; carries `computed_at` + `latency_ms`, no `cache_key`.
- `cached`: loaded from cache; carries original `computed_at` + `cache_key`, no latency.
- `fixture`: hand-written development data; notice contains `FIXTURE`, model is
  `fixture-model`, `checkpoint_sha256` is `null`.

**Errors**

| Status | `code` | When |
|---|---|---|
| `404` | `STUDY_NOT_FOUND` | Unknown `study_id` |
| `422` | `VALIDATION_ERROR` | Body failed schema validation (`detail.fields` lists paths) |
| `422` | `FINDING_NOT_IN_PROFILE` | `findings` contains an id outside the profile (`detail.findings`) |
| `422` | `PREPROCESSING_FAILED` etc. | Whole study could not be processed — no partial scores |
| `503` | `MODEL_NOT_LOADED` | API running in `model` mode (not implemented yet) |
| `500` | `INTERNAL_ERROR` | Unexpected (`retryable: true`) |

UI: [`useAnalysis.ts`](../web/src/components/findings/useAnalysis.ts) keeps one request in
flight, aborts on unmount, announces "Analysis complete. <source sentence>." and exposes
phases `idle | running | done | error`.

### 5.8 `GET /studies/{study_id}/explanations/{finding_id}?prediction_id=…` → `Explanation`

Fetched only for a `scored` finding with `explanation_available: true`, keyed by the
`prediction_id` from §5.7.

```bash
curl -s 'http://localhost:8000/studies/fx-study-001/explanations/acl?prediction_id=fx-pred-fx-study-001-interaction_prototype'
```

Available:

```json
{
  "schema_version": "0.1.0",
  "study_id": "fx-study-001",
  "finding_id": "acl",
  "prediction_id": "fx-pred-fx-study-001-interaction_prototype",
  "model_version": "fixture-0",
  "status": "available",
  "kind": "influential_slices",
  "series_id": "fx-ser-01",
  "plane": "sagittal",
  "coordinate_space": "rendered_slice_pixels",
  "rendered_width": 256,
  "rendered_height": 256,
  "slices": [
    { "slice_index": 12, "weight": 1.0 },
    { "slice_index": 13, "weight": 0.8 },
    { "slice_index": 15, "weight": 0.55 }
  ],
  "attention": [],
  "source": "fixture",
  "reason": null,
  "notice": "Shows what influenced the model score; it does not localise an injury."
}
```

Unavailable (HTTP 200, `status: "unavailable"` + `reason`, no content):

```json
{
  "status": "unavailable",
  "reason": { "code": "EXPLANATION_UNAVAILABLE", "message": "No explanation was produced for this finding." },
  "kind": null, "series_id": null, "plane": null, "slices": [], "attention": []
}
```

- `attention[]` maps are base64 PNG (`encoding: "png_base64_gray8"`), sized exactly
  `rendered_width × rendered_height`; draw them only when `prediction_id`, `model_version`,
  `series_id` and `slice_index` match what is on screen
  ([`alignment.ts`](../web/src/components/explanations/alignment.ts) `checkOverlay`).
- Wording: "influential slices" / "model attention" — never lesion localisation. Always
  show `notice`. On failure show "Explanation unavailable"; never manufacture an overlay.
- Errors: `404 STUDY_NOT_FOUND`, `422 VALIDATION_ERROR` (missing `prediction_id`),
  `422 FINDING_NOT_IN_PROFILE`, `503 MODEL_NOT_LOADED`.

### 5.9 `GET /studies/{study_id}/labels` → `StudyLabels`

Evaluation-only reveal. Nothing is requested until the user clicks "Reveal dataset label",
and the response is never sent anywhere else ([`tests/test_label_isolation.py`](../tests/test_label_isolation.py)).

```bash
curl -s http://localhost:8000/studies/fx-study-001/labels
```

```json
{
  "schema_version": "0.1.0",
  "study_id": "fx-study-001",
  "dataset_id": null,
  "origin": "fixture",
  "labels": [
    { "finding_id": "acl", "state": "positive", "provenance": "fixture", "source_ref": "contracts/fixtures/labels.json" },
    { "finding_id": "mcl", "state": "negative", "provenance": "fixture", "source_ref": "contracts/fixtures/labels.json" },
    { "finding_id": "medial_meniscus", "state": "unknown", "provenance": "fixture", "source_ref": "contracts/fixtures/labels.json" },
    { "finding_id": "lateral_meniscus", "state": "not_labeled", "provenance": "fixture", "source_ref": "contracts/fixtures/labels.json" }
  ],
  "notice": "Dataset labels are for evaluation only. They are never used by the model."
}
```

- `state`: `positive | negative | unknown | not_labeled` — **unknown is never a negative**;
  show it as unknown.
- Errors: `404 STUDY_NOT_FOUND`, `404 LABELS_UNAVAILABLE` (study has no labels — the
  reveal control shows the error with Retry), `503 MODEL_NOT_LOADED`.
- Show `notice` once any label is visible (see `useLabelReveal.notice`).

### 5.10 `GET /metrics` → `MetricsSnapshot`

```bash
curl -s http://localhost:8000/metrics
```

Fixture mode always returns the honest empty snapshot:

```json
{
  "schema_version": "0.1.0",
  "status": "unavailable",
  "reason": "No checkpoint has been trained and evaluated. Metrics are never fabricated; this snapshot stays unavailable until KS-EVAL-03 publishes a real one.",
  "origin": "fixture",
  "model": null, "dataset_id": null, "partition": null, "split_method": null,
  "grouping_unit": null, "n_studies": null, "created_at": null,
  "per_finding": [], "macro_roc_auc": null, "calibration": "not_assessed", "inference": null
}
```

When `status: "available"`: `model`, `dataset_id`, `partition` (`validation|test`),
`split_method`, `grouping_unit` (`patient|study`), `n_studies` and `created_at` are all
present; `per_finding[]` carries counts (`n_positive`, `n_negative`, `n_unknown`) and
`MetricValue`s (`roc_auc`, `pr_auc`, `sensitivity`, `specificity`, `brier`), each
`{value, status}` where `status` is `defined | undefined_single_class | not_computed`
(`value` present exactly when `defined`, `reason` otherwise). Render
`undefined_single_class` as undefined — never 0, 0.5 or hidden. Fixture snapshots may only
be `unavailable`. Errors: `503 MODEL_NOT_LOADED`, `500 INTERNAL_ERROR`.

### 5.11 `GET /model-card` → `ModelCard`

```bash
curl -s http://localhost:8000/model-card
```

```json
{
  "schema_version": "0.1.0",
  "status": "draft",
  "origin": "fixture",
  "model": null,
  "preprocessing": null,
  "sections": [
    { "section_id": "intended_use", "title": "Intended use", "body": "…" },
    { "section_id": "limitations", "title": "Limitations", "body": "…" }
  ],
  "limitations": [
    "Fixture data only: no trained checkpoint, no measured performance.",
    "Not a diagnostic tool; no clinical validation."
  ],
  "updated_at": null
}
```

Render `sections` in order and `limitations` as a list; `status` is `draft | published`.
Errors: `503 MODEL_NOT_LOADED`, `500 INTERNAL_ERROR`.

---

## 6. Error handling in the UI

The client ([`web/src/api/client.ts`](../web/src/api/client.ts)) maps every failure to an
`ApiRequestError`:

| Situation | `code` | `retryable` |
|---|---|---|
| Fetch rejected (offline, refused, CORS, DNS) | `API_UNREACHABLE` | `true` |
| Body is an `ApiError` | `error.code` from the table below | `error.retryable` |
| Non-2xx body of unknown shape | `UNEXPECTED_RESPONSE` | status ≥ 500 |

`ApiRequestError.canRetry` = `retryable || code === 'API_UNREACHABLE'` → drives the Retry
button in [`ErrorPanel`](../web/src/components/ErrorPanel.tsx). Pass `AbortSignal` on every
request; aborted requests must not surface as errors.

`ErrorCode` values ([`contracts/kneescope_contracts/models.py`](../contracts/kneescope_contracts/models.py)):

| Code | Typical status | Meaning |
|---|---|---|
| `STUDY_NOT_FOUND` | 404 | Unknown study id |
| `SERIES_NOT_FOUND` | 404 | Series not in that study |
| `SLICE_OUT_OF_RANGE` | 404 | `slice_index` outside `0..num_slices-1` |
| `LABELS_UNAVAILABLE` | 404 | Study has no dataset labels |
| `VALIDATION_ERROR` | 422 | Request failed schema validation; `detail.fields` |
| `FINDING_NOT_IN_PROFILE` | 422 | Finding id not in the active profile |
| `PREPROCESSING_FAILED` | 422 | Series could not be read/preprocessed |
| `INPUT_INVALID` | 422 | Input does not match the manifest / required plane missing |
| `EXPLANATION_UNAVAILABLE` | 200 body | No explanation produced (as `Explanation.reason`) |
| `INFERENCE_FAILED` / `INFERENCE_TIMEOUT` | 422 | Study-level model-side failure; also used inside a finding's `reason` (e.g. fixture `fx-study-001` → `medial_meniscus`) |
| `MODEL_NOT_LOADED` | 503 | Model-mode endpoint not implemented |
| `INTERNAL_ERROR` | 500 | Unexpected (`retryable: true`) |

Example error body:

```json
{
  "error": {
    "code": "STUDY_NOT_FOUND",
    "message": "Study does-not-exist not found.",
    "request_id": "req-1f2e3d4c5b6a",
    "retryable": false,
    "detail": null
  }
}
```

## 7. Enumerations quick reference

| Enum | Values |
|---|---|
| `Plane` | `sagittal`, `coronal`, `axial` |
| `DataOrigin` | `fixture`, `dataset` |
| `ResultSource` | `live`, `cached`, `fixture` |
| `FindingStatus` | `scored`, `not_evaluated`, `unavailable`, `unsupported`, `failed` |
| `ScoreKind` | `uncalibrated_model_score`, `calibrated_probability` |
| `AnalysisStatus` | `not_run`, `cached`, `failed` |
| `LabelState` | `positive`, `negative`, `unknown`, `not_labeled` |
| `LabelProvenance` | `expert_annotation`, `dataset_provided`, `report_extracted`, `fixture` |
| `SliceOrder` | `patient_position`, `instance_number`, `dataset_provided`, `synthetic` |
| `MetricValue.status` | `defined`, `undefined_single_class`, `not_computed` |

## 8. Copy rules the UI must follow (from `AGENTS.md` §16)

- Scores are **model scores**, never "probability" or "confidence" (unless
  `score_kind = calibrated_probability`, `KS-EVAL-05`).
- Explanations are **model attention / influential slices**, not lesion localisation; show
  `notice`; on failure show "Explanation unavailable".
- Fixture results are always visibly marked (`provenance.notice`, origin stripe).
- Unknown labels are not negatives; undefined AUC is shown as undefined.
- Dataset labels never feed inference.
- Rendered PNG brightness is **Display adjust**, not MRI window/level; planes are separate
  acquisitions and are not spatially synchronised.

## 9. Fixture studies for UI development

| Study id | What it exercises |
|---|---|
| `fx-study-001` | Happy path: 3 planes, 4 series, scores for `acl`/`mcl`, `failed` for `medial_meniscus`, `unsupported` for `lateral_meniscus`, explanation for `acl` |
| `fx-study-002` | Missing axial plane (`missing_planes: ["axial"]`) |
| `fx-study-003` | `POST /predictions` fails whole-study: `422 PREPROCESSING_FAILED` (retryable `false`) |
| `fx-study-004` | Missing sagittal plane → supported findings `unavailable` + `INPUT_INVALID`; `lateral_meniscus` (not supported by the fixture model) stays `unsupported` |

## 10. Keeping this document honest

- Changing a response shape is a contract change: follow `AGENTS.md` §8, bump
  `SCHEMA_VERSION`, then `make contracts` (regenerates OpenAPI, schemas, examples and
  `web/src/api/schema.d.ts`).
- Smoke-test any endpoint with `curl` against `make api`, or open `http://localhost:8000/docs`.
- Checks that must pass: `uv run python scripts/export_contracts.py --check`,
  `pnpm --dir web gen:api:check`, `python3 scripts/check_docs.py`.
