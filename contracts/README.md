# KneeScope shared contracts

Contract schema version: **0.1.0** (`SCHEMA_VERSION` in `kneescope_contracts/models.py`).

This directory is the single source of truth for every interface between workstreams.
Producers publish schema-compliant fixtures here first so consumers can build in
parallel. Changing anything here follows the contract-change procedure in
[`AGENTS.md`](../AGENTS.md#changing-a-shared-contract).

| Path | What it is | Edited by hand? |
|---|---|---|
| `kneescope_contracts/models.py` | Canonical Pydantic models (API and artifacts) | Yes — the source |
| `findings.json` | Finding IDs, display names, dataset column mappings, profiles | Yes |
| `fixtures/*.json` | Development fixtures (all marked FIXTURE) | Yes |
| `schema/*.schema.json` | JSON Schema per exported model | No — `scripts/export_contracts.py` |
| `openapi.json` | OpenAPI document of the API | No — generated |
| `examples/*.json` | Real responses from the API in fixture mode | No — generated |
| `web/src/api/schema.d.ts` | TypeScript types | No — `pnpm --dir web gen:api` |

CI fails if generated files are stale (`scripts/export_contracts.py --check`,
`pnpm --dir web gen:api:check`).

### Where the former `docs/contracts/01–07` templates went

| Former template | Now |
|---|---|
| 01 finding list | `findings.json` + §1 |
| 02 labels file | `StudyLabels`/`DatasetLabel` + §8; file format in KS-LABEL-01 |
| 03 folds file | split script + hash, KS-DATA-08 (§9 partition values) |
| 04 preprocessed exam | §4 (`preprocess_study`, `PlaneTensor`) |
| 05 model I/O | §5 (`ModelOutput`) |
| 06 metrics JSON | `MetricsSnapshot` + §9 |
| 07 OpenAPI | `openapi.json` (generated) + `web/src/api/schema.d.ts` |

---

## 1. Findings and profiles

- Finding IDs are lowercase snake_case and never reused with a different meaning.
  RSNA `acl` (ACL *injury*) and MRNet `acl_tear` are different IDs on purpose.
- A **profile** is the finding list a dataset can legitimately support. Profiles:
  `rsna4` (candidate), `mrnet3` (candidate), `interaction_prototype` (fixture only,
  default). The organizer-data profile is added only through the dataset decision (backlog
  `KS-DATA-04`).
- The API serves exactly one active profile (`KNEESCOPE_FINDING_PROFILE`). The UI renders
  whatever `GET /findings` returns; it never hard-codes a finding list.
- A profile becomes `selected` only through the dataset decision issue, with the data
  audit as evidence.

## 2. Studies, series, planes

- `study_id`, `series_id`: opaque strings matching `^[A-Za-z0-9._-]{1,128}$`. For RSNA
  they are derived from `StudyInstanceUID`/`SeriesInstanceUID` through a stable mapping
  kept outside git if UIDs are considered restricted; fixtures use `fx-` prefixes.
- `plane`: `sagittal | coronal | axial | null` (null = undetermined; such series are
  listed but never used as model input).
- `planes_available` equals the planes present in `series`; `missing_planes` is the
  complement. Enforced by `StudyDetail` validation.
- A study may have several series per plane. Series selection for model input is the
  adapter's documented rule (`DatasetAdapter.select_series`); the UI may show all.
- Planes are independent acquisitions. No contract field implies spatial
  synchronisation between planes.

## 3. Slice coordinates

- `slice_index` is **0-based** in the series' contract order. The UI displays
  `slice_index + 1`.
- Order is stated per series in `slice_order`: `patient_position` (ImagePositionPatient
  projected on the slice normal — the required rule for DICOM data), `instance_number`
  (fallback, must raise a warning), `dataset_provided`, or `synthetic`.
- Rendered slices: `GET /studies/{id}/series/{sid}/slices/{index}` returns an 8-bit
  grayscale PNG of exactly `rendered_width × rendered_height` from `SeriesSummary`.
- `rendered_slice_pixels` coordinate space: origin at the top-left pixel corner of that
  PNG, x to the right, y down, units in rendered pixels. Every overlay is expressed in
  this space for a specific `(series_id, slice_index)`.
- The rendering is a display mapping (percentile scaling), not MRI window/level.

## 4. Model input (preprocessed tensors)

Produced only by `kneescope_ml.preprocess.preprocess_study` with
`config/preprocessing.toml`. Current version: `prep-0.0.0-placeholder` (not frozen).

| Item | Contract |
|---|---|
| Planes | `sagittal`, `coronal`, `axial` — always all three keys present |
| Volume | `float32`, shape `(S, H, W)` = `(32, 256, 256)` per plane |
| Ordering | Volume slice `i` comes from series `source_slice_index[i]`; `-1` = padding |
| Sampling | Evenly spaced, centred over the ordered series; no repeats; shorter series padded |
| Mask | `bool (S,)`, true for real slices; padding and missing planes are false |
| Missing plane | `present = false`, zero volume, all-false mask, warning `"<plane> series missing"` |
| Normalisation | Per series: clip to 0.5th–99.5th percentile, then z-score; constant series → zeros |
| Resize | Bilinear, aspect preserved, centred, padded with the post-normalisation minimum |
| Orientation | As acquired in DICOM LPS terms; never mirrored. Laterality recorded, not flipped |
| Labels | Never present. Preprocessing has no access to labels |

A model must not treat a missing plane's zero volume as an image (use `present` and
`mask`). If a model requires a plane (`config/model.toml` `required_planes`) and it is
missing, every finding is `unavailable` with reason `INPUT_INVALID`.

## 5. Model output

`kneescope_ml.types.ModelOutput`: `scores` = independent sigmoid outputs keyed by
`finding_id`, one per supported finding; optional `slice_attention[plane]` of shape
`(S,)` aligned with that plane's `PlaneTensor`. Scores are **uncalibrated model scores**
unless a calibration artifact is loaded and recorded in the model card, in which case
`score_kind = calibrated_probability`.

## 6. Prediction response

`POST /predictions` → `PredictionResponse`. Rules enforced by the models:

| Situation | Representation |
|---|---|
| Model scored the finding | `status=scored`, `score∈[0,1]`, `score_kind` set |
| Low score | Still `scored` — e.g. `0.03`. Never a different status |
| Analysis not run / finding not requested | `not_evaluated` |
| Required input missing | `unavailable` + `reason` (`INPUT_INVALID`, message names the plane) |
| Profile lists it, model does not predict it | `unsupported` + `reason` |
| Inference error for this finding | `failed` + `reason` (`INFERENCE_FAILED`, …) |
| Whole study cannot be processed | HTTP 422 `ApiError` (`PREPROCESSING_FAILED`, …) — no partial scores |
| Threshold | Only with a validated threshold: `threshold` + `above_threshold` together |

Provenance (`provenance.source`):

- `live`: computed in this request by the loaded checkpoint; requires `computed_at` and
  `latency_ms`; no `cache_key`.
- `cached`: loaded from the prediction cache; requires original `computed_at` and
  `cache_key`; must not report a latency. Cache key = `study_id` + `model_version` +
  `checkpoint_sha256` + `preprocessing.version` + profile. Any mismatch is a cache miss.
- `fixture`: from `contracts/fixtures`; requires a notice containing `FIXTURE`; the model
  is `fixture-model` with no checkpoint hash. Live/cached results must carry a
  checkpoint hash.

### Future job-and-poll extension (not implemented)

Only if measured latency exceeds `serving.request_timeout_s` (backlog `KS-OPS-04`):
`POST /predictions` may return `202` with `{job_id, status: "queued"|"running", poll_url}`;
`GET /predictions/jobs/{job_id}` returns the same object until it returns `200` with a
`PredictionResponse`. In-process background task plus an in-memory or file job table —
no external queue. The `PredictionResponse` contract does not change.

## 7. Explanations

`GET /studies/{id}/explanations/{finding_id}?prediction_id=…` → `Explanation`.

- Bound to one `study_id`, `finding_id`, `prediction_id`, `model_version`, `series_id`.
- `slices[].slice_index` uses series slice coordinates (§3), mapped back through
  `source_slice_index`; weights are relative (max = 1).
- `attention[]` maps must equal `rendered_width × rendered_height`; the client draws
  them only if the series, slice, prediction and model version match what is displayed.
- `status=unavailable` + `reason` when not produced. Never synthesise an overlay.
- Wording: "Influential slices" / "Model attention". The `notice` field is shown with it.

## 8. Dataset labels

`GET /studies/{id}/labels` → `StudyLabels`. Evaluation and the "Reveal dataset label"
action only. States: `positive`, `negative`, `unknown` (labelled uncertain or missing
in a labelled study), `not_labeled` (study outside the labelled subset). Unknown is never
treated as negative. `provenance`: `expert_annotation`, `dataset_provided`,
`report_extracted` (with rule version in `source_ref`), or `fixture`.
Labels never reach preprocessing, the model, or `POST /predictions`.

## 9. Metrics

`GET /metrics` → `MetricsSnapshot`. Per finding: positive/negative/unknown counts,
`roc_auc`, `pr_auc`, sensitivity/specificity at a validation-selected threshold, Brier
score — each a `MetricValue` with `status` `defined | undefined_single_class |
not_computed`. ROC AUC with only one class present must be `undefined_single_class`
(never 0, 0.5, or omitted). Macro AUC lists included and excluded findings.
`partition` is `validation` or `test` — results tuned on a partition are never labelled
`test`. Fixture snapshots may only be `unavailable`.

## 10. Errors

Every non-2xx JSON response is `ApiError`:
`{"error": {"code", "message", "request_id", "retryable", "detail"}}`. Codes are
`ErrorCode` values. Messages are safe to display; they never include file paths, stack
traces, report text, or request bodies. `X-Request-ID` header matches `request_id`.

## 11. Versions

- Contract: `SCHEMA_VERSION` (semver; minor = additive, major = breaking).
- Findings registry: `findings.json` `registry_version`.
- Preprocessing: `config/preprocessing.toml` `version` + file SHA-256.
- Model: `config/model.toml` `model_version` + checkpoint SHA-256.
All four appear in predictions, metrics snapshots and the model card.
