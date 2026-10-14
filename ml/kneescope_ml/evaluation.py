"""Evaluation metrics producing contract ``MetricsSnapshot`` objects.

Rules (contracts/README.md section 9, AGENTS.md section 16):
- Labels ``unknown`` and ``not_labeled`` are excluded per finding and counted in
  ``n_unknown``; they are never treated as negative.
- ROC AUC with only one class present is ``undefined_single_class`` — never 0, 0.5 or
  silently dropped — and the finding is listed in ``macro_roc_auc.excluded``.
- Thresholded metrics need a threshold selected on validation; otherwise they are
  ``not_computed``.
- Accuracy is deliberately not reported.

Implemented with numpy only so it runs without the heavy ``ml`` extra.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Literal

import numpy as np
import numpy.typing as npt

from kneescope_contracts.models import (
    DataOrigin,
    FindingMetrics,
    InferenceMeasurement,
    MacroAuc,
    MetricsSnapshot,
    MetricValue,
    ModelInfo,
    PreprocessingInfo,
    Reason,
)

KNOWN = {"positive": 1, "negative": 0}
LABEL_STATES = {"positive", "negative", "unknown", "not_labeled"}

Partition = Literal["validation", "test"]


def roc_auc(y: npt.NDArray[np.int_], s: npt.NDArray[np.float64]) -> float:
    """Mann-Whitney ROC AUC with average ranks for ties. Requires both classes."""
    ranks = _average_ranks(s)
    n_pos = int(y.sum())
    n_neg = len(y) - n_pos
    return float((ranks[y == 1].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def average_precision(y: npt.NDArray[np.int_], s: npt.NDArray[np.float64]) -> float:
    """Step-wise average precision (area under the PR curve), ties grouped by score."""
    order = np.argsort(-s, kind="mergesort")
    y_sorted, s_sorted = y[order], s[order]
    distinct = np.r_[np.diff(s_sorted) != 0, True]
    tp = np.cumsum(y_sorted)[distinct]
    fp = np.cumsum(1 - y_sorted)[distinct]
    precision = tp / (tp + fp)
    recall = tp / y.sum()
    recall_prev = np.r_[0.0, recall[:-1]]
    return float(np.sum((recall - recall_prev) * precision))


def _average_ranks(values: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    order = np.argsort(values, kind="mergesort")
    ranks = np.empty(len(values), dtype=np.float64)
    sorted_vals = values[order]
    i = 0
    while i < len(values):
        j = i
        while j + 1 < len(values) and sorted_vals[j + 1] == sorted_vals[i]:
            j += 1
        ranks[order[i : j + 1]] = (i + j) / 2 + 1
        i = j + 1
    return ranks


def _defined(value: float) -> MetricValue:
    return MetricValue(value=value, status="defined")


def _not_computed(reason: str) -> MetricValue:
    return MetricValue(status="not_computed", reason=reason)


def finding_metrics(
    finding_id: str,
    scores: Sequence[float],
    labels: Sequence[str],
    threshold: float | None = None,
) -> FindingMetrics:
    """Metrics for one finding over one partition. ``labels`` uses contract label states."""
    if len(scores) != len(labels):
        raise ValueError(f"{finding_id}: {len(scores)} scores but {len(labels)} labels")
    bad = set(labels) - LABEL_STATES
    if bad:
        raise ValueError(f"{finding_id}: unknown label states {sorted(bad)}")
    s_all = np.asarray(scores, dtype=np.float64)
    if not np.isfinite(s_all).all() or (s_all < 0).any() or (s_all > 1).any():
        raise ValueError(f"{finding_id}: scores must be finite and within [0, 1]")
    known = np.array([lbl in KNOWN for lbl in labels], dtype=bool)
    y = np.array([KNOWN[lbl] for lbl, k in zip(labels, known, strict=True) if k], dtype=np.int_)
    s = s_all[known]
    n_pos, n_neg = int(y.sum()), int(len(y) - y.sum())
    n_unknown = int((~known).sum())

    if n_pos and n_neg:
        auc, ap = _defined(roc_auc(y, s)), _defined(average_precision(y, s))
    else:
        missing = "positive" if n_pos == 0 else "negative"
        reason = f"No {missing} studies with known labels (n+ = {n_pos}, n- = {n_neg})."
        auc = MetricValue(status="undefined_single_class", reason=reason)
        ap = MetricValue(status="undefined_single_class", reason=reason) if n_pos == 0 else _defined(1.0)
    brier = (
        _defined(float(np.mean((s - y) ** 2))) if len(y) else _not_computed("No studies with known labels.")
    )

    if threshold is None:
        sens = spec = _not_computed("No validated threshold.")
    else:
        pred = s >= threshold
        sens = _defined(float(pred[y == 1].mean())) if n_pos else _not_computed("No positive studies.")
        spec = _defined(float((~pred[y == 0]).mean())) if n_neg else _not_computed("No negative studies.")

    return FindingMetrics(
        finding_id=finding_id,
        n_positive=n_pos,
        n_negative=n_neg,
        n_unknown=n_unknown,
        roc_auc=auc,
        pr_auc=ap,
        prevalence=(n_pos / len(y)) if len(y) else None,
        threshold=threshold,
        threshold_selected_on="validation" if threshold is not None else None,
        sensitivity=sens,
        specificity=spec,
        brier=brier,
    )


def macro_auc(per_finding: Sequence[FindingMetrics]) -> MacroAuc:
    included = [m for m in per_finding if m.roc_auc.status == "defined"]
    excluded = [
        Reason(code=m.finding_id, message=m.roc_auc.reason or m.roc_auc.status)
        for m in per_finding
        if m.roc_auc.status != "defined"
    ]
    value = float(np.mean([m.roc_auc.value for m in included])) if included else None
    return MacroAuc(value=value, included=[m.finding_id for m in included], excluded=excluded)


def compute_metrics(
    scores: Mapping[str, Sequence[float]],
    labels: Mapping[str, Sequence[str]],
    *,
    partition: Partition,
    model: ModelInfo,
    preprocessing: PreprocessingInfo,
    dataset_id: str,
    split_method: str,
    grouping_unit: Literal["patient", "study"],
    created_at: datetime,
    thresholds: Mapping[str, float | None] | None = None,
    inference: InferenceMeasurement | None = None,
) -> MetricsSnapshot:
    """Build an available ``MetricsSnapshot`` for one partition.

    ``scores[finding]`` and ``labels[finding]`` are aligned per study, in the same study
    order for every finding. Thresholds must come from the validation partition.
    """
    if partition not in ("validation", "test"):
        raise ValueError("partition must be 'validation' or 'test'")
    if set(scores) != set(labels):
        raise ValueError("scores and labels must cover the same findings")
    lengths = {len(v) for v in scores.values()}
    if len(lengths) != 1:
        raise ValueError("every finding must be scored on the same studies")
    thresholds = thresholds or {}
    per_finding = [finding_metrics(f, scores[f], labels[f], thresholds.get(f)) for f in sorted(scores)]
    return MetricsSnapshot(
        status="available",
        origin=DataOrigin.dataset,
        model=model,
        preprocessing=preprocessing,
        dataset_id=dataset_id,
        partition=partition,
        split_method=split_method,
        grouping_unit=grouping_unit,
        n_studies=lengths.pop(),
        per_finding=per_finding,
        macro_roc_auc=macro_auc(per_finding),
        inference=inference,
        created_at=created_at,
    )
