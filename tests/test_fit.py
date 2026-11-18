# tests/test_fit.py
import pytest
from src.fit import garment_full_chest, label, fit_for_size, ease


def test_flat_is_doubled():
    assert garment_full_chest(19, "flat") == 38


def test_circumference_passes_through():
    assert garment_full_chest(40, "circumference") == 40


def test_unknown_method_raises():
    with pytest.raises(ValueError):
        garment_full_chest(19, "guess")


@pytest.mark.parametrize("body, raw, method, expected", [
    (38, 19, "flat", "Fitted"),      # worked example: ease 0
    (38, 17, "flat", "Tight"),       # garment 34, ease -4
    (38, 18, "flat", "Tight"),       # garment 36, ease -2
    (38, 18.5, "flat", "Fitted"),    # garment 37, ease -1
])
def test_worked_examples(body, raw, method, expected):
    assert fit_for_size(raw, method, body) == expected


@pytest.mark.parametrize("ease_in, expected", [
    (-1.01, "Tight"),
    (-1.0, "Fitted"),
    (0.0, "Fitted"),
    (2.0, "Fitted"),
    (2.01, "Relaxed"),
    (4.0, "Relaxed"),
    (4.01, "Loose"),
])
def test_label_boundaries(ease_in, expected):
    assert label(ease_in) == expected


def test_implausible_body_raises():
    with pytest.raises(ValueError):
        ease(40, 9)