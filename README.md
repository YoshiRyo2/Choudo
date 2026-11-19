# Nimbus: Measurement-based outfit fit app

**Team:** Ryo, Derek

---

## Problem

Online shoppers get two things wrong when buying clothes:

1. **Fit.** Size charts don't tell you how a garment will fit your body, so people guess and return items.
2. **Outfits.** Combining pieces from different brands means checking each one separately.

Nimbus lets people enter their body measurements once, then swipe through clothes from different brands and see how each one fits their body.

Existing try-on tools like ChatGPT or Google often rely on camera or face photos. Nimbus does not require a face or camera, so users can check fit without sharing their image.

## Open question

How accurate can size predictions be, given that brand measurements vary and garments stretch?

## Users

Anyone shopping for clothes online who wants to know how a size will fit before they order.

## v1 scope

- Tops and bottoms (tees, long sleeves, polos, button-ups, jeans, chinos, joggers, trousers)
- Body input: height and weight, plus optional chest, waist, hips and inseam to replace our estimates
- A 2D mannequin scaled to the body, wearing the chosen top and bottom
- Fit per zone (chest, waist, hips, length, sleeve, inseam) with the difference in cm or inches
- Guest mode only, with data stored on the device
- Size comparison with a confidence label (estimated vs. measured body numbers)

## Non-goals for v1

- Photos, camera, or AR
- User accounts
- Photo-based or 3D avatars (the mannequin is one component so it can be swapped later)

## Success criteria

- Predictions match ten testers' real fits at least [80]% of the time for one brand and one category.
- At least [eight] of ten testers say they'd use it again for a real purchase.

## Status

v1 slice works end to end: body input -> swipe tops and bottoms -> pick a size -> see the fit.
Garment data is a hand-made seed: the Knightweave and Lands' End tees are real (copied from
`data/tees.csv`); everything else is marked placeholder and must be replaced with real charts.

## Getting started

The web app lives in `app/` (React + TypeScript + Vite). You need Node 20 or newer.

```bash
cd app
npm install
npm run dev      # open the printed URL; use the "Network" URL to try it on your phone
npm test         # unit tests (body model, garment data, fit engine, UI helpers)
npm run check    # typecheck + tests + garment data check — run before every commit
npm run data:check  # just the garment data report (grades, warnings, errors)
npm run fit:report  # how predictions compare with the fit test (data/fit_tests.csv)
```

### The 10-person fit test

Turn on Test mode under Edit body → "For fit testers". In the fitting room, put the tester's
top on the mannequin, then record how it really fits (chest, length, the size they'd keep).
Each result keeps the app's prediction and odds. "Download CSV" gives rows to paste into
`data/fit_tests.csv` (keep its header); `npm run fit:report` then prints label agreement,
within-one agreement, size hit rate and calibration.

### Garment photos

Product photos (used to texture garments on the mannequin) are **not committed**: we don't
hold the rights to redistribute them, so `app/photo-sources/` and `app/public/garments/` are
git-ignored. A fresh clone draws every garment in its flat colour until you add them:

1. Save the source photo in `app/photo-sources/` under the name in
   `app/scripts/garment-photos.json` (see `app/photo-sources/README.md`).
2. Run `npm run photos` from `app/` to cut the garment out into `app/public/garments/`.

Size-chart snapshots follow the same rule: they live in `app/chart-snapshots/`, git-ignored.
To add a garment, follow `docs/adding-garments.md`.

Where things live:

- `app/src/domain/body/` — height + weight -> body measurements (swap the estimator here)
- `app/src/domain/garments/seed.json` — garment size charts
- `app/src/domain/fit/` — the fit engine (`rules.ts` thresholds), personal preference
  (`preference.ts`), sampled odds (`sampleFit.ts`, spreads in `uncertainty.ts`)
- `app/src/ui/` — screens and components

The original Python chest-fit script is still in `src/` and `tests/` as the reference spec
(`python -m pytest`). See `CLAUDE.md` for project rules and conventions.