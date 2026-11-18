import pytest

from src.report import build_report, label_row, load_rows, main

CSV_TEXT = """brand,product,size,chest_raw_in,chest_method,length_in,sleeve_in,sleeve_def,source_url,date_captured,notes
Knightweave,Tee,M,20,flat,29,17,shoulder_to_cuff,https://example.com,2026-11-17,
Knightweave,Tee,L,22,flat,30,18.5,shoulder_to_cuff,https://example.com,2026-11-17,
LandsEnd,Super-T,M,44,unknown,28.5,10,top_of_sleeve,https://example.com,2026-11-17,
Other,Tee,M,40,circumference,28,8,top_of_sleeve,https://example.com,2026-11-17,
"""


@pytest.fixture
def csv_path(tmp_path):
    p = tmp_path / "tees.csv"
    p.write_text(CSV_TEXT)
    return p


def test_flat_row_is_labelled(csv_path):
    rows = load_rows(csv_path)
    full, label = label_row(rows[0], 38)  # 20 flat -> 40, ease +2
    assert full == 40
    assert label == "Fitted"


def test_unknown_method_is_not_guessed(csv_path):
    rows = load_rows(csv_path)
    full, label = label_row(rows[2], 38)
    assert full is None
    assert label == "Method unverified"


def test_circumference_row(csv_path):
    rows = load_rows(csv_path)
    full, label = label_row(rows[3], 38)  # 40, ease +2
    assert full == 40
    assert label == "Fitted"


def test_bad_chest_value():
    row = {"chest_raw_in": "n/a", "chest_method": "flat"}
    assert label_row(row, 38) == (None, "Bad chest value")


def test_brand_filter(csv_path):
    report = build_report(load_rows(csv_path), 38, brand="knightweave")
    assert [r["size"] for r in report] == ["M", "L"]


def test_ease_is_reported(csv_path):
    report = build_report(load_rows(csv_path), 38, brand="Knightweave")
    assert report[1]["ease"] == 6.0  # 22 flat -> 44, ease +6
    assert report[1]["label"] == "Loose"


def test_implausible_chest_raises(csv_path):
    with pytest.raises(ValueError):
        build_report(load_rows(csv_path), 9)


def test_main_prints_table(csv_path, capsys):
    main(["--chest", "38", "--csv", str(csv_path)])
    out = capsys.readouterr().out
    assert "Knightweave" in out
    assert "Method unverified" in out