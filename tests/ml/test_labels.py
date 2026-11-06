from pathlib import Path

import pytest

from kneescope_ml.labels import (
    LABEL_STATES,
    build_label_rows,
    column_map_for_profile,
    state_from_dataset_value,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (1, "positive"),
        ("1", "positive"),
        (0, "negative"),
        ("0.0", "negative"),
        ("", "unknown"),
        (None, "unknown"),
        (float("nan"), "unknown"),
        ("uncertain", "unknown"),
    ],
)
def test_state_mapping(raw, expected):
    assert state_from_dataset_value(raw) == expected


def test_blank_and_uncertain_are_never_negative():
    for raw in ("", None, float("nan"), "uncertain"):
        assert state_from_dataset_value(raw) != "negative"


def test_unrecognised_value_is_rejected():
    with pytest.raises(ValueError):
        state_from_dataset_value("maybe")


def test_outputs_are_valid_states():
    for raw in (1, 0, "", "uncertain"):
        assert state_from_dataset_value(raw) in LABEL_STATES


FINDINGS = Path(__file__).parents[2] / "contracts" / "findings.json"


def test_rsna4_column_map_matches_findings_json():
    mapping = column_map_for_profile(FINDINGS, "rsna4")
    assert mapping == {
        "acl": "ACL",
        "mcl": "MCL",
        "medial_meniscus": "Medial Meniscus",
        "lateral_meniscus": "Lateral Meniscus",
    }


def test_prototype_profile_has_no_dataset():
    with pytest.raises(ValueError):
        column_map_for_profile(FINDINGS, "interaction_prototype")


def test_build_rows_blank_is_unknown_and_unlabelled_study_is_not_labeled():
    column_map = {"acl": "ACL", "mcl": "MCL"}
    rows = [{"study_id": "fake-1", "ACL": 1, "MCL": ""}]
    result = build_label_rows(rows, column_map, all_study_ids=["fake-1", "fake-2"])
    states = {(r["study_id"], r["finding_id"]): r["state"] for r in result}
    assert states[("fake-1", "acl")] == "positive"
    assert states[("fake-1", "mcl")] == "unknown"
    assert states[("fake-2", "acl")] == "not_labeled"
    assert states[("fake-2", "mcl")] == "not_labeled"


def test_build_rows_rejects_duplicate_study():
    rows = [{"study_id": "fake-1", "ACL": 1}, {"study_id": "fake-1", "ACL": 0}]
    with pytest.raises(ValueError):
        build_label_rows(rows, {"acl": "ACL"})


def test_build_rows_rejects_missing_column():
    with pytest.raises(ValueError):
        build_label_rows([{"study_id": "fake-1"}], {"acl": "ACL"})
