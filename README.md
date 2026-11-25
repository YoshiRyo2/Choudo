# Choudo: Measurement-based outfit fit app

**Team:** Ryo, Derek

---

## Problem

Online shoppers get two things wrong when buying clothes:

1. **Fit.** Size charts don't tell you how a garment will fit your body, so people guess and return items.
2. **Outfits.** Combining pieces from different brands means checking each one separately.

Choudo lets people enter their body measurements once, then swipe through clothes from different brands and see how each one fits their body.

Existing try-on tools like ChatGPT or Google often rely on camera or face photos. Choudo does not require a face or camera, so users can check fit without sharing their image.

## Open question

How accurate can size predictions be, given that brand measurements vary and garments stretch?

## Users

Anyone shopping for clothes online who wants to know how a size will fit before they order.

## v1 scope

- Tops and bottoms (tees, long sleeves, polos, button-ups, jeans, chinos, joggers, trousers)
- Body input: height, weight and "size me in women's / men's clothes", plus optional chest (full bust),
  waist, hips, inseam and (women's) bra size to replace our estimates
- A 2D mannequin scaled to the body, wearing the chosen top and bottom
- Fit per zone (chest, waist, hips, length, sleeve, inseam) with the difference in cm or inches
- Guest mode only, with data stored on the device (the website counts anonymous visits with
  GoatCounter: no cookies, no measurements)
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

The web app lives in `app/` (React + TypeScript + Vite); the fit engine and the UI's pure
helpers live in `packages/core`. You need Node 20 or newer.

From the repo root:

```bash
npm install      # installs packages/core and app together
npm test         # unit tests: core (body model, garment data, fit engine, UI helpers), then app
npm run check    # typecheck + tests for core, app and mobile + garment data check — run before every commit
```

### The iPhone app

The native app lives in `mobile/` (Expo SDK 58, Expo Router) and uses the same engine from
`packages/core`: the Fitting room, Discover and the Closet, as on the web, plus sharing an outfit
as a picture. To run it on your iPhone, install **Expo Go** from the App Store, then from the
repo root:

```bash
npm install
cd mobile && npx expo start
```

Scan the QR code with the iPhone camera (phone and Mac on the same Wi-Fi) and it opens in
Expo Go. `npm run check` from `mobile/` runs its typecheck and tests.

To put it on the App Store (and TestFlight), follow [`docs/app-store-release.md`](docs/app-store-release.md).

From `app/`:

```bash
npm run dev      # open the printed URL; use the "Network" URL to try it on your phone
npm run data:check  # just the garment data report (grades, warnings, errors)
npm run fit:report  # how predictions compare with the fit test (data/fit_tests.csv)
```

### The 10-person fit test

Turn on Test mode under Edit body → "For fit testers". In the fitting room, put the tester's
top on the mannequin, then record how it really fits (chest, length, the size they'd keep).
Each result keeps the app's prediction and odds. "Download CSV" (on the phone, "Export CSV",
in development and fit-test builds: see the release guide, step 5) gives rows to paste into
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

- `packages/core/domain/body/` — height + weight -> body measurements (swap the estimator here)
- `packages/core/domain/garments/seed.json` — garment size charts
- `packages/core/domain/fit/` — the fit engine (`rules.ts` thresholds), personal preference
  (`preference.ts`), sampled odds (`sampleFit.ts`, spreads in `uncertainty.ts`)
- `packages/core/ui-logic/` — the UI's pure helpers (wording, stored data, mannequin geometry)
- `app/src/ui/` — screens and components

`packages/core` is shared code with no React or DOM, so the native app in `mobile/` uses it too.
Run `npm install` and `npm run check` from the repo root. See `CLAUDE.md` for project rules
and conventions.