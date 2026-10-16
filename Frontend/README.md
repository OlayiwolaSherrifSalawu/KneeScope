# KneeScope — Frontend

A knee MRI review tool frontend built with **Vanilla JavaScript (ES Modules)** and **Tailwind CSS v4**, powered by **Vite**.

## Quick Start

### Prerequisites
- Node.js ≥ 18
- Backend running on `http://localhost:8000`

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (proxies /api → http://localhost:8000)
npm run dev
```

The app is available at **http://localhost:5173**.

### Backend

Start the KneeScope backend on port 8000 before opening the app. The Vite proxy strips `/api` and forwards requests to `http://localhost:8000`.

---

## Architecture

```
src/
├── main.js                 # Entry point — imports CSS, registers routes
├── router.js               # Tiny History API SPA router
├── style.css               # Tailwind v4 + custom design tokens
├── api/
│   ├── client.js           # All API endpoints + fetch error mapping
│   └── errors.js           # ApiRequestError, AbortError
├── state/
│   └── store.js            # Observable store + asyncState (idle|loading|done|error)
├── utils/
│   └── dom.js              # h(), setText(), empty(), mount(), icon()
├── components/
│   ├── navbar.js           # Navigation bar
│   ├── errorPanel.js       # Error display with Retry button
│   ├── statusBadge.js      # Status badges (scored/failed/unavailable/…)
│   ├── fixtureStripe.js    # Amber stripe for fixture data
│   ├── skeleton.js         # Loading skeleton placeholders
│   └── toast.js            # Toast notifications + aria-live
└── pages/
    ├── studies.js          # Studies list with filter + table
    ├── review.js           # MRI viewer + findings + explanations + labels
    └── evaluation.js       # Metrics table + model card
```

### Routes
| Path | Page |
|---|---|
| `/` | Studies list |
| `/studies/:studyId` | Review (viewer + findings) |
| `/evaluation` | Metrics + model card |

---

## Fixture Studies (for testing)

| ID | Scenario |
|---|---|
| `fx-study-001` | Happy path: ACL/MCL scored, medial meniscus failed, lateral meniscus unsupported, ACL explanation |
| `fx-study-002` | Missing axial plane |
| `fx-study-003` | POST /predictions fails with PREPROCESSING_FAILED |
| `fx-study-004` | Missing sagittal, all findings unavailable, INPUT_INVALID |

To test the **API-unreachable** state: stop the backend and visit any page.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Override the API base URL |

---

## Design System

- **Font:** Inter (Google Fonts)
- **Brand colours:** `#e63946` (accent red) / `#ffffff` (white)
- **Accent palette:** teal for scored, red for failed, amber for unavailable/fixture, slate for unsupported
- **Radius:** 8px, **Spacing:** 8px grid

## Assumptions

1. **`/findings` returns `{ findings: [...] }`** — findings list is global (not per-study), shape `{ finding_id, display_name }`.
2. **`/studies` returns `{ studies: [...], origin_notice }`** — studies array with fields `study_id`, `label`, `origin`, `planes`, `series`, `analysis_status`.
3. **Study series** have: `series_id`, `plane`, `num_slices`, `used_by_model`, `rendered_width`, `rendered_height`, `pulse_sequence`, `modality`, `fov`, `slice_thickness`.
4. **POST /predictions** returns `{ prediction_id, model_version, findings: { [finding_id]: { status, score, score_kind, label_display, threshold, above_threshold, explanation_available, reason, provenance, warnings } }, calibration_check, provenance }`.
5. **GET /explanations** returns `{ slices: [{ slice_index, label, weight, series_id }], attention: [{ slice_index, series_id, data: base64gray8 }], notice }`.
6. **GET /labels** returns `{ findings: { [finding_id]: { state: 'positive'|'negative'|'unknown'|'not_labeled' } }, notice }`.
7. **GET /metrics** returns `{ status, model_version, dataset, partition, split_method, n_studies, findings: { [id]: { roc_auc, pr_auc, sensitivity, specificity, brier } }, run_id }`.
8. **GET /model-card** returns `{ status, sections: [{ title, kind, content?, items? }] }`.
9. Slice images are served as PNGs from `/studies/{id}/series/{seriesId}/slices/{index}`.
10. The `score_kind` field controls the "probability" / "confidence" language restriction — only used when `score_kind === 'calibrated_probability'`.
