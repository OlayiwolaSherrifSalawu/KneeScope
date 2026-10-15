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
| Members who accepted terms (names only) | all six team members confirmed to M1 in the team chat on 15 Oct 2026; names to be listed under KS-SCOPE-02 | `<…>` | `<…>` |
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
| Dataset / version / download date | RSNA Knee Abnormality Detection (Kaggle); read in place in a Kaggle notebook, 2026-10-15; not downloaded |
| Studies (total / labelled) | 4,407 / 58 |
| Series per study (median, range) | 5.0, 4–11 (audit of 100 studies on disk) |
| Slices per series (median, range) | 30, 11–320 (same sample) |
| Transfer syntaxes (counts) | Explicit VR Little Endian: 565 (sampled files) |
| Unreadable/corrupt files | 0 unreadable, 0 undecodable (sampled files) |
| Disk size of subset used | not measured (read in place); tensor cache 865 MB |

## 3. Labels (KS-DATA-03, KS-LABEL-01)

| Finding | Positive | Negative | Unknown/missing | Not labelled | Source |
|---|---|---|---|---|---|
| ACL | 24 | 34 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| MCL | 9 | 49 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Medial Meniscus | 26 | 32 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Lateral Meniscus | 23 | 35 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Medial OA | 15 | 43 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Lateral OA | 11 | 47 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| PF OA | 21 | 37 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Effusion | 35 | 23 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Synovitis | 27 | 31 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Baker's | 12 | 46 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Contusion | 19 | 39 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |
| Fracture | 18 | 40 | 0 | 4349 | train.csv (audit_dataset.py, 2026-10-15) |

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
| Sagittal | 100 of 100 inspected | 0 | `RsnaAdapter.select_series` (rule above) |
| Coronal | 100 of 100 inspected | 0 | same |
| Axial | 100 of 100 inspected | 0 | same |

## 5. Grouping and splits (KS-DATA-08)

```bash
python scripts/make_splits.py --dataset rsna --root data/rsna --profile rsna4 --seed 2026
python scripts/make_splits.py ... --expect-hash <sha256>   # teammate verification
```

Groups are patients (PatientID) when present, otherwise studies. Writes
`artifacts/splits/*.csv` with salted group hashes (no patient IDs) and prints the counts
table for this section. `--fractions 0.8,0.2,0` gives a validation-only design.

- Patient identifier available: `PatientID` (DICOM header); 100 distinct in the 100 inspected studies; the 58 labelled studies form 58 groups, so no two share a patient
- Site identifier available: no site field; `Manufacturer` (10 distinct) and `ManufacturerModelName` (26) are present in the inspected studies
- Split method, seed, split hash: grouped by PatientID, profile `rsna4`, seed 2026, default fractions 0.7/0.15/0.15; hash `2aaff952a4e7e2f7a39eef0bc67be0ae46579276827b4509e05e1d7b147f01b2` (a teammate still needs to verify with `--expect-hash`)

| Partition | Studies | Per-finding n+ / n− / unknown |
|---|---|---|
| Train | 37 | ACL 17/20/0; MCL 6/31/0; Medial Meniscus 18/19/0; Lateral Meniscus 16/21/0 |
| Validation | 10 | ACL 3/7/0; MCL 1/9/0; Medial Meniscus 4/6/0; Lateral Meniscus 4/6/0 |
| Test (if any) | 11 | ACL 4/7/0; MCL 2/9/0; Medial Meniscus 4/7/0; Lateral Meniscus 3/8/0 |

Held-out partitions have 1 to 4 positives per finding. MCL has 1 (validation) and 2 (test), so MCL must be reported as limited / not measured.

## 6. Demo studies (KS-DATA-10)

```bash
python scripts/build_manifest.py --dataset rsna --root data/rsna \
    --split-file artifacts/splits/rsna-rsna4-seed2026.csv --n 4
```

Evaluation partitions only; includes a missing-plane study when one exists.

Manifest IDs only, partition of each, role (correct / error / limitation), permission
basis (row in §1).
