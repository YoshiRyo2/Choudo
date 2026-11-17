#!/usr/bin/env bash
set -euo pipefail
REPO="YoshiRyo2/nimbus"

mk() { gh issue create --repo "$REPO" --title "$1" --body "$2"; }

mk "P0: Write one-page scope and success criteria" "Done when both of us sign off."
mk "P0: Set up README and project board, one issue per phase" "Done when the board shows all phases."
mk "P0: Assign owners for data/engine and interface" "Done when each issue has an owner."
mk "P1: Write garment and fit spec" "Covers garment types, measurement mapping, flat-to-circumference rule, ease thresholds. Done when both of us review it."
mk "P1: Collect garment data for three brands" "About 15 rows per brand with source URL, date, chart type. Done when the sheet has about 45 sourced rows."
mk "P1: Review each brand's terms of use for data restrictions" "Done when each brand has a written note."
mk "P2: Build conversion and ease logic as separate functions" "Done when each function has a unit test."
mk "P2: Add edge-case tests" "Missing values, implausible inputs, threshold boundaries. Done when all tests pass."
mk "P2: Hand-check ten results against the spec" "Done when all ten match."
mk "P3: Build guest mode with on-device storage" "Done when data survives a page reload."
mk "P3: Build guided measurement flow with validation messages" "Done when a new user finishes it in under five minutes."
mk "P3: Build size comparison view with confidence label" "Done when each size shows a fit label per measurement."
mk "P4: Recruit ten testers and log predicted vs actual fit" "Done when all ten results are logged."
mk "P4: Calculate agreement against 80% bar and record decision" "Done when the result is recorded."
mk "P5: Fix engine or data based on validation" "Done when the re-test meets the bar or the decision is documented."
mk "P5: Add export and import for guest data" "Done when a file round-trips between two browsers."
mk "P5: Draft privacy policy matching actual stored data" "Done when it's reviewed against the code."
mk "P6: Build saved outfits with layering rules" "Done when a tester saves three outfits."
mk "P7: Run small beta and collect feedback" "Done when feedback from at least ten people is logged."
mk "P7: Write go, pivot, or pause decision" "Done when it's committed to the repo."
