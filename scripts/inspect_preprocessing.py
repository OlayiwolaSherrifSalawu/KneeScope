"""Write contact sheets of preprocessed model input for visual inspection (KS-DATA-07).

  python scripts/inspect_preprocessing.py --dataset fixture --n 4
  python scripts/inspect_preprocessing.py --dataset rsna --root data/rsna --n 10

One PNG per study under artifacts/inspect/ (git-ignored): rows = sagittal, coronal,
axial; columns = the S sampled slices, each labelled with its source slice_index. Values
are the normalised tensor rescaled to 0-255 for display only. Missing planes and padding
are drawn as hatched tiles. Contact sheets of real data stay local unless the data terms
permit sharing (docs/data-audit.md section 1).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from kneescope_ml.config import load_preprocessing_config
from kneescope_ml.preprocess import PreprocessingError, preprocess_study
from kneescope_ml.types import PreprocessedStudy

TILE, GAP, LABEL_H = 96, 2, 12


def hatch(size: int) -> np.ndarray:
    yy, xx = np.mgrid[0:size, 0:size]
    return np.where((xx + yy) % 8 < 2, 90, 20).astype(np.uint8)


def contact_sheet(study: PreprocessedStudy) -> Image.Image:
    planes = list(study.planes)
    s = next(iter(study.planes.values())).volume.shape[0]
    width = s * (TILE + GAP)
    height = len(planes) * (TILE + LABEL_H + GAP) + LABEL_H
    sheet = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(sheet)
    draw.text((2, 0), f"{study.preprocessing_version} | model input, not an image for review", fill=200)
    for r, plane in enumerate(planes):
        pt = study.planes[plane]
        y0 = LABEL_H + r * (TILE + LABEL_H + GAP)
        draw.text((2, y0), f"{plane}{'' if pt.present else ' (missing)'}", fill=220)
        vol = pt.volume
        lo, hi = (float(vol[pt.mask].min()), float(vol[pt.mask].max())) if pt.mask.any() else (0.0, 1.0)
        for i in range(s):
            x0 = i * (TILE + GAP)
            if pt.mask[i]:
                tile = ((vol[i] - lo) / max(hi - lo, 1e-6) * 255).clip(0, 255).astype(np.uint8)
                img = Image.fromarray(tile).resize((TILE, TILE), Image.Resampling.NEAREST)
                label = str(int(pt.source_slice_index[i]))
            else:
                img, label = Image.fromarray(hatch(TILE)), "pad"
            sheet.paste(img, (x0, y0 + LABEL_H))
            draw.text((x0 + 2, y0 + LABEL_H + 2), label, fill=255)
    return sheet


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["fixture", "rsna"], default="fixture")
    ap.add_argument("--root", type=Path, default=None)
    ap.add_argument("--n", type=int, default=4)
    ap.add_argument("--out", type=Path, default=Path("artifacts/inspect"))
    args = ap.parse_args()

    if args.dataset == "rsna":
        if args.root is None:
            ap.error("--root is required for --dataset rsna")
        from kneescope_ml.adapters.rsna import RsnaAdapter

        adapter = RsnaAdapter(args.root)
    else:
        from kneescope_ml.adapters.fixture import FixtureAdapter

        adapter = FixtureAdapter()  # type: ignore[assignment]

    cfg = load_preprocessing_config()
    args.out.mkdir(parents=True, exist_ok=True)
    written = failed = 0
    for idx, study_id in enumerate(adapter.list_studies()[: args.n]):
        try:
            refs = adapter.select_series(study_id)
            series = {p: adapter.load_series(study_id, r.series_id) for p, r in refs.items()}
            pre = preprocess_study(study_id, series, cfg)
        except PreprocessingError as exc:
            failed += 1
            print(f"study #{idx}: preprocessing failed: {exc}")
            continue
        contact_sheet(pre).save(args.out / f"study-{idx:03d}.png")  # index, not UID, in names
        notes = [*pre.warnings, *(w for s in series.values() for w in s.warnings)]
        print(f"study #{idx}: ok{' — ' + '; '.join(notes) if notes else ''}")
        written += 1
    print(f"{written} contact sheet(s) in {args.out}, {failed} failed, preprocessing {cfg.version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
