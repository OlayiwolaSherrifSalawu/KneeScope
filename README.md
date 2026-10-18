# KneeScope

**Knee MRI research review prototype — not for diagnosis.**

KneeScope allows researchers to inspect knee MRI studies across imaging planes (sagittal, coronal, axial), run abnormality detection models, inspect influential slices and model attention maps, reveal and compare dataset labels, and examine measured evaluation metrics and model limitations.

> **Current state: scaffold in fixture mode.** No dataset has been selected and no model has been trained. Studies are displayed as synthetic geometric phantoms (not MRIs), and results are labelled **FIXTURE**.

## Features

1. **Study Browser**: View permitted studies, filter by study ID, inspect available planes, series counts, and analysis status.
2. **Review Workspace**:
   - **Multi-plane MRI Viewer**: High-performance canvas viewer supporting zoom (fit up to 400%), pan, display adjustments (brightness, contrast, inversion), keyboard shortcuts (`1`/`2`/`3` plane switching, `[`/`]` or arrow slice navigation, `+`/`-`/`0` zoom, `h`/`j`/`k`/`l` pan), and slice prefetching.
   - **Findings & Predictions**: Run model analysis (`r` key) to receive scores for supported findings (ACL, MCL, Medial Meniscus, Lateral Meniscus) with provenance tracking and missing plane warnings.
   - **Model Attention & Influential Slices**: Inspect influential slice weights and toggle ochre-to-rust attention overlays with adjustable opacity.
   - **Label Reveal**: Separate step to inspect dataset labels alongside model predictions for audit and evaluation.
3. **Model Evaluation & Card**:
   - Comprehensive metrics ledger showing macro and finding-specific ROC AUC, sensitivity, specificity, and calibration status.
   - Transparent model card covering intended use, out-of-scope clinical caveats, dataset provenance, and documented limitations.

## Quick Start

```bash
npm install
npm run dev
```

The application runs on Vite at `http://localhost:3000`.

## Build

```bash
npm run build
```
