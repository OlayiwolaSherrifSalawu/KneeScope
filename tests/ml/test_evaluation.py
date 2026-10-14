"""KS-EVAL-01: metrics with explicit unknown and undefined handling."""

from datetime import UTC, datetime

import pytest

from kneescope_contracts.models import MetricsSnapshot, ModelInfo, PreprocessingInfo
from kneescope_ml.evaluation import compute_metrics, finding_metrics

MODEL = ModelInfo(
    model_id="m",
    model_version="1.0.0",
    checkpoint_sha256="ab" * 32,
    finding_profile="rsna4",
    supported_findings=["acl", "mcl"],
    trained_on="test-data",
)
PREP = PreprocessingInfo(version="prep-1.0.0", config_sha256=None)
COMMON = dict(
    model=MODEL,
    preprocessing=PREP,
    dataset_id="synthetic",
    split_method="grouped",
    grouping_unit="study",
    created_at=datetime(2026, 10, 13, tzinfo=UTC),
)

Y6 = ["positive", "positive", "positive", "negative", "negative", "negative"]
S6 = [0.9, 0.8, 0.4, 0.7, 0.3, 0.1]


def test_roc_auc_matches_hand_computation():
    # Positive-over-negative pairs: 3 + 3 + 2 = 8 of 9.
    m = finding_metrics("acl", S6, Y6)
    assert m.roc_auc.status == "defined"
    assert m.roc_auc.value == pytest.approx(8 / 9, abs=1e-9)


def test_pr_auc_matches_hand_computation():
    # Precision 1, 1, then 3/4 at each recall step of 1/3.
    m = finding_metrics("acl", S6, Y6)
    assert m.pr_auc.value == pytest.approx((1 + 1 + 0.75) / 3, abs=1e-9)


def test_ties_count_half():
    assert finding_metrics("acl", [0.5, 0.5], ["positive", "negative"]).roc_auc.value == 0.5


def test_single_class_is_undefined_and_excluded_from_macro():
    snap = compute_metrics(
        {"acl": S6, "mcl": [0.2, 0.4, 0.6, 0.1, 0.3, 0.5]},
        {"acl": Y6, "mcl": ["positive"] * 6},
        partition="validation",
        **COMMON,
    )
    mcl = next(m for m in snap.per_finding if m.finding_id == "mcl")
    assert mcl.roc_auc.status == "undefined_single_class" and mcl.roc_auc.value is None
    assert snap.macro_roc_auc is not None
    assert snap.macro_roc_auc.included == ["acl"]
    assert [r.code for r in snap.macro_roc_auc.excluded] == ["mcl"]
    assert snap.macro_roc_auc.value == pytest.approx(8 / 9)


def test_unknown_labels_are_excluded_not_negative():
    with_unknown = finding_metrics("acl", [*S6, 0.95, 0.05], [*Y6, "unknown", "not_labeled"])
    known_only = finding_metrics("acl", S6, Y6)
    assert with_unknown.n_unknown == 2
    assert (with_unknown.n_positive, with_unknown.n_negative) == (3, 3)
    assert with_unknown.roc_auc.value == known_only.roc_auc.value


def test_threshold_metrics_require_a_threshold():
    without = finding_metrics("acl", S6, Y6)
    assert without.sensitivity.status == "not_computed"
    with_thr = finding_metrics("acl", S6, Y6, threshold=0.5)
    assert with_thr.sensitivity.value == pytest.approx(2 / 3)
    assert with_thr.specificity.value == pytest.approx(2 / 3)
    assert with_thr.threshold_selected_on == "validation"


def test_snapshot_validates_and_reports_no_accuracy():
    snap = compute_metrics({"acl": S6}, {"acl": Y6}, partition="test", **COMMON)
    MetricsSnapshot.model_validate(snap.model_dump())
    assert snap.status == "available" and snap.n_studies == 6
    assert "accuracy" not in snap.model_dump_json()


@pytest.mark.parametrize(
    "scores,labels",
    [
        ([0.1, 1.5], ["positive", "negative"]),
        ([0.1], ["positive", "negative"]),
        ([0.1, 0.2], ["positive", "maybe"]),
    ],
)
def test_invalid_inputs_raise(scores, labels):
    with pytest.raises(ValueError):
        finding_metrics("acl", scores, labels)


def test_partition_must_be_named():
    with pytest.raises(ValueError):
        compute_metrics({"acl": S6}, {"acl": Y6}, partition="train", **COMMON)  # type: ignore[arg-type]
