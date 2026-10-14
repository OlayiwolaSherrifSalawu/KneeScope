"""Fixture-backed artifacts (contracts/fixtures).

Studies are served through ``kneescope_api.catalogue`` (fixture or dataset manifest,
KS-API-01). Predictions, explanations, labels, metrics and the model card come from the
fixtures in fixture mode; the prediction cache is KS-API-04.
"""

from __future__ import annotations

import json
from functools import cached_property
from pathlib import Path
from typing import Any

from kneescope_contracts.models import (
    MetricsSnapshot,
    ModelCard,
    StudyDetail,
    StudySummary,
)

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "contracts" / "fixtures"


def _load(name: str) -> Any:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


class FixtureStore:
    """Read-only view over contracts/fixtures. Validates everything on load."""

    @cached_property
    def studies(self) -> dict[str, StudyDetail]:
        return {s["study_id"]: StudyDetail.model_validate(s) for s in _load("studies.json")["studies"]}

    def summaries(self) -> list[StudySummary]:
        return [
            StudySummary.model_validate(s.model_dump(include=set(StudySummary.model_fields)))
            for s in sorted(self.studies.values(), key=lambda s: s.study_id)
        ]

    @cached_property
    def predictions(self) -> dict[str, dict[str, Any]]:
        return dict(_load("predictions.json")["studies"])

    @cached_property
    def explanations(self) -> dict[str, dict[str, Any]]:
        return dict(_load("explanations.json")["explanations"])

    @cached_property
    def labels(self) -> dict[str, dict[str, Any]]:
        return dict(_load("labels.json")["studies"])

    @cached_property
    def metrics(self) -> MetricsSnapshot:
        return MetricsSnapshot.model_validate(_load("metrics.json"))

    @cached_property
    def model_card(self) -> ModelCard:
        return ModelCard.model_validate(_load("model-card.json"))
