"""Print a fit label for every brand and size in the tee data.

Usage:
    python -m src.report --chest 38
    python -m src.report --chest 38 --csv data/tees.csv --brand Uniqlo
"""
import argparse
import csv
from pathlib import Path

from src.fit import fit_for_size, validate_body_chest

KNOWN_METHODS = {"flat", "circumference"}


def load_rows(csv_path):
    with open(csv_path, newline="") as f:
        return list(csv.DictReader(f))


def label_row(row, body_chest_in):
    """Return (garment_full_chest_or_None, label) for one CSV row."""
    method = (row.get("chest_method") or "").strip()
    if method not in KNOWN_METHODS:
        return None, "Method unverified"
    try:
        raw = float(row["chest_raw_in"])
    except (KeyError, TypeError, ValueError):
        return None, "Bad chest value"
    full = raw * 2 if method == "flat" else raw
    return full, fit_for_size(raw, method, body_chest_in)


def build_report(rows, body_chest_in, brand=None):
    validate_body_chest(body_chest_in)
    out = []
    for row in rows:
        if brand and row.get("brand", "").lower() != brand.lower():
            continue
        full, label = label_row(row, body_chest_in)
        ease = None if full is None else round(full - body_chest_in, 2)
        out.append({
            "brand": row.get("brand", ""),
            "product": row.get("product", ""),
            "size": row.get("size", ""),
            "garment_chest": full,
            "ease": ease,
            "label": label,
        })
    return out


def format_report(report):
    header = f"{'Brand':<12} {'Product':<42} {'Size':<5} {'Chest':>6} {'Ease':>6}  Label"
    lines = [header, "-" * len(header)]
    for r in report:
        chest = "" if r["garment_chest"] is None else f"{r['garment_chest']:.1f}"
        ease = "" if r["ease"] is None else f"{r['ease']:+.1f}"
        lines.append(
            f"{r['brand']:<12} {r['product'][:42]:<42} {r['size']:<5} "
            f"{chest:>6} {ease:>6}  {r['label']}"
        )
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Fit label for every size.")
    parser.add_argument("--chest", type=float, required=True,
                        help="Body chest circumference in inches")
    parser.add_argument("--csv", default="data/tees.csv",
                        help="Path to the tee data CSV")
    parser.add_argument("--brand", default=None,
                        help="Only show one brand")
    args = parser.parse_args(argv)

    if not Path(args.csv).exists():
        parser.error(f"CSV not found: {args.csv}")

    report = build_report(load_rows(args.csv), args.chest, args.brand)
    print(format_report(report))


if __name__ == "__main__":
    main()