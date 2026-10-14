"""Study catalogues behind /studies, /studies/{id} and the slice endpoint (KS-API-01).

- ``FixtureCatalogue``: synthetic studies from contracts/fixtures (origin "fixture"),
  slices watermarked "SYNTHETIC - NOT AN MRI".
- ``DatasetCatalogue``: permitted studies from a manifest built by
  scripts/build_manifest.py (origin "dataset"), pixels read through the dataset adapter.

Both render with the shared ``kneescope_ml.render.render_slice_png`` and return identical
response contracts. Errors never include local paths or file names. Labels are not
touched here.
"""

from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path
from typing import Protocol

from kneescope_api.errors import ApiException
from kneescope_api.store import FixtureStore
from kneescope_contracts.models import ErrorCode, StudyDetail, StudySummary
from kneescope_ml.adapters.fixture import FixtureAdapter
from kneescope_ml.config import PreprocessingConfig
from kneescope_ml.preprocess import PreprocessingError
from kneescope_ml.render import render_slice_png
from kneescope_ml.types import SeriesVolume

FIXTURE_NOTICE = "FIXTURE - synthetic development studies, not dataset studies."
SYNTHETIC_WATERMARK = "SYNTHETIC - NOT AN MRI"


class _Lru[K, V]:
    def __init__(self, size: int) -> None:
        self.size, self.items = size, OrderedDict[K, V]()

    def get(self, key: K) -> V | None:
        if key in self.items:
            self.items.move_to_end(key)
            return self.items[key]
        return None

    def put(self, key: K, value: V) -> None:
        self.items[key] = value
        self.items.move_to_end(key)
        while len(self.items) > self.size:
            self.items.popitem(last=False)


class StudyCatalogue(Protocol):
    origin: str
    notice: str | None

    def summaries(self) -> list[StudySummary]: ...

    def detail(self, study_id: str) -> StudyDetail: ...

    def slice_png(self, study_id: str, series_id: str, index: int) -> bytes: ...


class _BaseCatalogue:
    origin = "dataset"
    notice: str | None = None
    watermark: str | None = None

    def __init__(self, studies: dict[str, StudyDetail], prep: PreprocessingConfig) -> None:
        self._studies, self._prep = studies, prep
        self._volumes: _Lru[tuple[str, str], SeriesVolume] = _Lru(4)
        self._pngs: _Lru[tuple[str, str, int], bytes] = _Lru(256)

    def summaries(self) -> list[StudySummary]:
        fields = set(StudySummary.model_fields)
        return [
            StudySummary.model_validate(s.model_dump(include=fields))
            for s in sorted(self._studies.values(), key=lambda s: s.study_id)
        ]

    def detail(self, study_id: str) -> StudyDetail:
        found = self._studies.get(study_id)
        if found is None:
            raise ApiException(404, ErrorCode.STUDY_NOT_FOUND, f"Study {study_id} not found.")
        return found

    def slice_png(self, study_id: str, series_id: str, index: int) -> bytes:
        study = self.detail(study_id)
        series = next((s for s in study.series if s.series_id == series_id), None)
        if series is None:
            raise ApiException(404, ErrorCode.SERIES_NOT_FOUND, f"Series {series_id} not found.")
        if index >= series.num_slices:
            raise ApiException(
                404, ErrorCode.SLICE_OUT_OF_RANGE, f"slice_index must be 0..{series.num_slices - 1}."
            )
        cached = self._pngs.get((study_id, series_id, index))
        if cached is not None:
            return cached
        volume = self._volumes.get((study_id, series_id))
        if volume is None:
            try:
                volume = self._load(study_id, series_id)
            except PreprocessingError as exc:  # message is reviewer-safe by contract
                raise ApiException(422, ErrorCode.PREPROCESSING_FAILED, str(exc)) from None
            except OSError:
                raise ApiException(
                    422, ErrorCode.PREPROCESSING_FAILED, "Series files could not be read."
                ) from None
            if volume.pixels.shape[0] != series.num_slices:
                raise ApiException(
                    422,
                    ErrorCode.INPUT_INVALID,
                    "Series on disk does not match the manifest; rebuild the manifest.",
                )
            self._volumes.put((study_id, series_id), volume)
        png = render_slice_png(volume, index, self._prep, watermark=self.watermark)
        self._pngs.put((study_id, series_id, index), png)
        return png

    def _load(self, study_id: str, series_id: str) -> SeriesVolume:
        raise NotImplementedError


class FixtureCatalogue(_BaseCatalogue):
    origin = "fixture"
    notice: str | None = FIXTURE_NOTICE
    watermark = SYNTHETIC_WATERMARK

    def __init__(self, store: FixtureStore, prep: PreprocessingConfig) -> None:
        super().__init__(store.studies, prep)
        self._adapter = FixtureAdapter()

    def _load(self, study_id: str, series_id: str) -> SeriesVolume:
        return self._adapter.load_series(study_id, series_id)


class DatasetCatalogue(_BaseCatalogue):
    """Manifest studies, read from ``data_root`` through the RSNA adapter."""

    def __init__(self, manifest: Path, data_root: Path, prep: PreprocessingConfig) -> None:
        from kneescope_ml.adapters.rsna import RsnaAdapter

        try:
            raw = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise ValueError("KNEESCOPE_MANIFEST could not be read as a manifest JSON file") from None
        studies = {}
        for entry in raw["studies"]:
            detail = StudyDetail.model_validate(entry)
            if detail.origin.value != "dataset":
                raise ValueError("manifest studies must have origin 'dataset'")
            studies[detail.study_id] = detail
        super().__init__(studies, prep)
        self._adapter = RsnaAdapter(data_root)

    def _load(self, study_id: str, series_id: str) -> SeriesVolume:
        return self._adapter.load_series(study_id, series_id)
