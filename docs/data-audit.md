# Data audit — TEMPLATE

> **Status: template, partially pre-filled from public pages only.** No data has been
> downloaded or inspected. Sections marked `<…>` are filled by KS-DATA-01/02/03/08/10.
> Never put study UIDs, patient information or report text in this file — counts only.

## 1. Access and permitted use

Facts below were read from the public Kaggle competition pages on 2026-10-13 (Overview,
Data, Rules). They are not legal advice; quote clauses when filling the table.

**RSNA Knee Abnormality Detection (Kaggle, 2026)** — public facts:
- 12 per-study binary labels: ACL, MCL, Medial Meniscus, Lateral Meniscus, Medial OA,
  Lateral OA, PF OA, Effusion, Synovitis, Baker's, Contusion, Fracture.
- "Only a small subset of training studies carry per-condition labels"; original
  multilingual report text is provided for training studies; test labels are hidden.
- DICOM series organised `train_series/<StudyInstanceUID>/<SeriesInstanceUID>/`;
  `train_series.csv` gives `Anatomical_Plane`, `Fluid_Sensitive`, `Fat_Suppression`.
  Series typically 20–45 slices (median 30). Mixed transfer syntaxes (Explicit/Implicit
  VR, JPEG Lossless, JPEG 2000). Metadata stripped to 86 allow-listed tags.
- ~570 GB, ~820k files.
- Rules §4a: data may be used "for any purpose, whether commercial or non-commercial …
  and for academic research and education", subject to the MIRA license
  (http://rsna.org/mira-license). Rules §4b: participants must not "transmit, duplicate,
  publish, redistribute or otherwise provide or make available the Competition Data to
  any party not participating in the Competition".
- Entry deadline (rules acceptance): 15 October 2026, 23:59 UTC. Final submission
  deadline 22 October 2026 (not relevant to KneeScope, which is not a submission).

| Use | RSNA | MRNet | Organizer data |
|---|---|---|---|
| Training | `<yes/no/unclear + clause>` | `<…>` | `<…>` |
| Evaluation | `<…>` | `<…>` | `<…>` |
| Local demo to judges | `<…>` | `<…>` | `<…>` |
| Public hosting of rendered slices | `<…>` (see §4b) | `<…>` | `<…>` |
| Recorded video showing slices | `<…>` | `<…>` | `<…>` |
| Publishing model weights | `<…>` | `<…>` | `<…>` |
| Members who accepted terms (names only) | `<…>` | `<…>` | `<…>` |
| Agreement / access status | `<…>` | `<not requested / requested / approved>` | `<offered?>` |

Unclear items default to **not permitted** for hosting and recordings until answered.

### Draft questions for the data providers (not sent)

Drafted for the coordinator to review and send if they choose (AGENTS.md §13); agents do
not contact organizers or dataset providers.

To RSNA (informatics@rsna.org, listed in the RSNA challenge announcement):
1. May a team that accepted the competition Rules use the Competition Data in a separate,
   non-commercial hackathon project (research and education) under the MIRA license?
2. May we show rendered slices from the data to hackathon judges in a live local demo,
   given Rules §4b prohibits making data available to non-participants?
3. May a recorded demo video that shows rendered slices be shared with the judges only,
   or must recordings use synthetic images?
4. May model weights trained on the data be shared with the judges or published?

To the hackathon organizers:
1. Do you provide a dataset, and under what terms (training, demo, recording, hosting)?
2. Which labels does it carry, and how were they produced?

## 2. Dataset inventory (KS-DATA-03)

Produce with (counts only; never UIDs, patient IDs or report text):

```bash
uv sync --extra ml
python scripts/audit_dataset.py --dataset rsna --root data/rsna --out artifacts/audit/rsna.json --markdown
```

Paste the printed tables into sections 2–4. A second person reruns the command on the same
subset; the JSON must be identical.

| Item | Value |
|---|---|
| Dataset / version / download date | `<…>` |
| Studies (total / labelled) | `<…>` |
| Series per study (median, range) | `<…>` |
| Slices per series (median, range) | `<…>` |
| Transfer syntaxes (counts) | `<…>` |
| Unreadable/corrupt files | `<…>` |
| Disk size of subset used | `<…>` |

## 3. Labels (KS-DATA-03, KS-LABEL-01)

| Finding | Positive | Negative | Unknown/missing | Not labelled | Source |
|---|---|---|---|---|---|
| `<…>` | | | | | |

## 4. Planes and series

Series selection rule implemented by `RsnaAdapter.select_series` (one series per plane for
model input; all series stay viewable):
1. Plane from `Anatomical_Plane`, cross-checked with the DICOM orientation normal; a
   disagreement sets the plane to unknown and the series is never selected.
2. Prefer fluid-sensitive, then fat-suppressed, then more slices, then the smallest
   SeriesInstanceUID (deterministic).
3. Slices are ordered by ImagePositionPatient along the slice normal; InstanceNumber only
   as a flagged fallback. Images are never mirrored.

| Plane | Studies with ≥1 series | Studies missing | Series selection rule |
|---|---|---|---|
| Sagittal | | | `<…>` |
| Coronal | | | |
| Axial | | | |

## 5. Grouping and splits (KS-DATA-08)

```bash
python scripts/make_splits.py --dataset rsna --root data/rsna --profile rsna4 --seed 2026
python scripts/make_splits.py ... --expect-hash <sha256>   # teammate verification
```

Groups are patients (PatientID) when present, otherwise studies. Writes
`artifacts/splits/*.csv` with salted group hashes (no patient IDs) and prints the counts
table for this section. `--fractions 0.8,0.2,0` gives a validation-only design.

- Patient identifier available: `<field name or "not available">`
- Site identifier available: `<…>`
- Split method, seed, split hash: `<…>`

| Partition | Studies | Per-finding n+ / n− / unknown |
|---|---|---|
| Train | | |
| Validation | | |
| Test (if any) | | |

## 6. Demo studies (KS-DATA-10)

```bash
python scripts/build_manifest.py --dataset rsna --root data/rsna \
    --split-file artifacts/splits/rsna-rsna4-seed2026.csv --n 4
```

Evaluation partitions only; includes a missing-plane study when one exists.

Manifest IDs only, partition of each, role (correct / error / limitation), permission
basis (row in §1).
