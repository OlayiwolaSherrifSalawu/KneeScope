import pytest

from kneescope_ml.labels import LABEL_STATES, state_from_dataset_value


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