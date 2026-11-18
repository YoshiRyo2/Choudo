# src/fit.py
def garment_full_chest(chest_raw_in: float, method: str) -> float:
    """Convert a garment chest value to full circumference."""
    if method == "flat":
        return chest_raw_in * 2
    if method == "circumference":
        return chest_raw_in
    raise ValueError(f"unknown chest_method: {method}")


def validate_body_chest(body_chest_in: float) -> float:
    """Reject implausible body chest values before any comparison."""
    if not 25 <= body_chest_in <= 70:
        raise ValueError(f"body chest {body_chest_in} in is outside 25-70 in")
    return body_chest_in


def ease(garment_full_chest_in: float, body_chest_in: float) -> float:
    return garment_full_chest_in - validate_body_chest(body_chest_in)


def label(ease_in: float) -> str: 
    if ease_in < -1:
        return "Tight"
    if ease_in <= 2:
        return "Fitted"
    if ease_in <= 4:
        return "Relaxed"
    return "Loose"


def fit_for_size(chest_raw_in: float, method: str, body_chest_in: float) -> str:
    return label(ease(garment_full_chest(chest_raw_in, method), body_chest_in))