# Security and restricted assets

KneeScope has no accounts or authentication (out of scope). Its security work is about
keeping restricted data, reports, labels and model artifacts where their terms allow, and
keeping them out of logs, error messages and the repository.

## What may be committed

| Allowed | Never committed |
|---|---|
| Code, configs, docs, generated contract files | DICOM/NIfTI or any dataset images (`*.dcm`, `*.nii*`, …) |
| Synthetic fixtures in `contracts/fixtures/` (geometric phantoms) | Radiology report text, even excerpts |
| Counts and aggregate statistics in docs | Study/series UIDs or patient identifiers in docs or issues |
| The two source PDFs (design inputs) | Labels files whose terms forbid sharing |
| | Checkpoints, cached tensors, prediction caches (`*.pt`, `*.ckpt`, `*.npz`, …) |
| | Anything under `data/` or `artifacts/` |
| | Secrets: Kaggle keys, tokens, passwords, `.env` |

Enforced by `scripts/check_restricted_assets.py` (CI on every push/PR). It blocks the
file types above, anything under `data/` or `artifacts/`, and files larger than 5 MB
unless allow-listed with a reason in the script. Run it locally before pushing:

```bash
python3 scripts/check_restricted_assets.py
```

## RSNA Knee data obligations

From the competition Rules (§4, read 2026-10-13, https://www.kaggle.com/competitions/rsna-knee-abnormality-detection/rules):

- Use is permitted for research and education subject to the MIRA license
  (http://rsna.org/mira-license).
- Participants must use reasonable measures to prevent people who have not agreed to the
  Rules from accessing the data, and must not transmit, publish, redistribute or
  otherwise make the data available to non-participants.
- Participants must notify Kaggle immediately on learning of possible unauthorised
  access or transmission.

Consequences for KneeScope until `KS-DATA-01` records otherwise:

- Each person who downloads or views the data accepts the Rules personally.
- No public hosting of rendered slices from the dataset (`KS-OPS-05` decides hosting).
- Recordings that show dataset slices stay local (`KS-DEMO-03`).
- Do not upload images, reports or labels to external services (AI APIs, notebooks,
  paste sites, issue trackers) without recorded authorization.

## Runtime rules

- The API binds to `127.0.0.1` in `scripts/dev-api.sh`. Do not expose it publicly with
  dataset content.
- Error responses carry a code, a safe message and a request ID. They never include file
  paths, stack traces, request bodies or report text. Validation errors list field
  locations only.
- Logs must not contain request bodies, report text or data-root paths. Verified by
  `tests/test_restricted_assets.py` for failing prediction requests; extend it when new
  routes touch data.
- CORS allows only the configured origins (`KNEESCOPE_CORS_ORIGINS`).
- Identifiers in path parameters are restricted to `^[A-Za-z0-9._-]{1,128}$`, which
  rejects path traversal.

## Incident steps

If restricted data was committed, pushed, uploaded or shared:

1. Stop and tell the coordinator immediately. Do not try to hide it.
2. Remove access (make the artifact private or delete the upload) where you can.
3. A force-push or history rewrite to remove a committed file needs coordinator approval;
   assume anything pushed to a public repository has been copied.
4. For RSNA data, notify Kaggle as the Rules require.
5. Record what happened and what was done in `docs/decisions.md`.
