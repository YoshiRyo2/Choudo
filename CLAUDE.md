# Nimbus — CLAUDE.md

Nimbus is a virtual clothing try-on app. Users browse shirts and pants and see how each
**size** would actually fit a mannequin scaled to their height and weight. The core
promise is **true-to-size fit**: compare a garment's real measurements (from the brand's
size chart) to the user's body, zone by zone, and report the difference in cm.

Team of two: Ryo (data + fit engine), Derek (interface). Keep code readable; prefer small,
well-named modules over clever ones.

## Hard constraints (v1)
- **Guest only.** No accounts, no login, no backend user data. Anything stored stays on
  the device (`localStorage`).
- **No face, no photo, no camera.** Body input = height + weight, plus optional
  chest / waist / hips / inseam overrides.
- **No AR, body scanning, or photo avatars yet.** Keep the mannequin behind one component
  so a 3D/SMPL renderer can replace it later — but don't build it.

## Stack
- React + TypeScript + Vite (web app, mobile-first), in `app/`.
- Vitest for unit tests (`*.test.ts` next to the code they test).
- Mannequin is a 2D parametric SVG — no Three.js until a real body model is worth it.
- No state library, no UI kit. Plain React state, a small `localStorage` hook, plain CSS.

## Layout
```
app/src/
  domain/        pure TypeScript, no React, never imports from ui/
    units.ts     cm/in, kg/lb conversion. Everything internal is cm and kg.
    body/        estimateBody(input) -> BodyMeasurements
    garments/    types.ts (schema), seed.json, normalize.ts (printed -> cm + provenance),
                 validate.ts (structure), verify.ts + verifyRules.ts (stage-5 checks),
                 grade.ts (confidence grade), report.ts (npm run data:check text)
    fit/         fitGarment(body, garment, size) -> per-zone fit results
  ui/            React
    screens/     BodyScreen (input), FittingRoom (browse + size + fit), Discover (swipe feed),
                 Closet + closet/ (Liked, Folders, Outfits tabs)
    components/  Mannequin/ (pure geometry.ts, topShape.ts, photoWarp.ts + SVG), SwipeCard/ (pure swipe.ts),
                 GarmentCarousel, GarmentBadge, SizePicker, FitReadout, FitSheet, Sheet (<dialog>), TabBar, NameForm,
                 ConfirmButton, TapeScale, SegmentedControl
    state/       usePersistentState (localStorage), stored.ts (keys + guards), outfit.ts,
                 feed.ts (likes/passes, feed order), closet.ts (folders, saved outfits), useCloset.ts
    fitText.ts   all user-facing fit wording
    styles.css   design tokens (colours, type scale)
app/scripts/   data-check.mjs (npm run data:check), garment-photos.mjs (npm run photos)
app/chart-snapshots/, app/photo-sources/   local copies of charts and photos, git-ignored
docs/          adding-garments.md (checklist for adding a garment by hand)
src/, tests/, data/   (repo root) original Python chest-fit engine + real tee CSV.
                      Kept as the reference spec; the app's engine is the TS port.
```
Rule: **body estimation, the fit engine, and garment data stay in `domain/`** with clear
inputs/outputs and unit tests. UI only calls their public functions.

## Fit rules (summary — source of truth is `domain/fit/`)
- Girth zones (chest, waist, hips): ease = garment − body (cm).
  Labels: tight / fitted / relaxed / loose (ported from `src/fit.py`, converted to cm).
- Length zones (top length, sleeve, inseam): garment − target length derived from body.
  Labels: short / good / long.
- Missing or unverified garment measurements give `unknown`, never a guess
  (same rule as `src/report.py`'s "Method unverified").
- Flat (half-chest) chart values are doubled to full circumference.
- A top's length is only scored when the chart measures it from the high point of the
  shoulder (`lengthDefinition: "hps"`); a sleeve only when it's `shoulder_to_cuff` on a long sleeve.
- A size's overall result is never "good" when a girth couldn't be checked; it's "unknown"
  (unless something is definitely bad). `recommendSize` never picks a size on length alone.
- Stretch fabric moves the "tight" boundary (`STRETCH_ALLOWANCE` in `rules.ts`).
- Woven shirts currently use the tee chest thresholds — likely too strict; tune in `rules.ts`.

## Garment data rules (source of truth is `domain/garments/`)
- Garments live in `app/src/domain/garments/seed.json`. To add one by hand, follow
  `docs/adding-garments.md`.
- Every real row has a source tier (A brand spec … G photo only), `url`, `capturedOn`, and
  optionally a `snapshot` of the chart. Placeholders have `placeholder: true` and no tier.
- Seed values are copied as printed. A value is a plain number (from the chart) or
  `{ value, origin: chart | estimated | audited, how }`. `normalizeGarment` converts to cm
  and keeps each value's origin, printed number and conversions (`GarmentSize.provenance`).
- `checkGarment` (stage 5) returns errors and warnings. Errors leave the garment out of the
  catalogue and fail `npm run data:check`: a size smaller than the one before, or a flat
  girth that looks like a full circumference (or the reverse). Warnings need review:
  uneven grading, implausible ranges, chest ease for the fit intent, and audit vs chart.
  Thresholds are in `verifyRules.ts`.
- Confidence grade (`gradeGarment`), checked in order: **unscored** (girth method or top
  length definition unknown) → **estimated** (any estimated value, a placeholder, or tier
  E–G) → **verified** (tier A–C, no warnings, audited) → **charted**.
- UI: cards show the grade badge (or "Sample data"); the readout footer gives source, date,
  tier in plain words and grade; estimated numbers get "est."; estimated garments draw with
  a faint dash.

## Commands (run from `app/`)
```bash
npm install        # install
npm run dev        # dev server at http://localhost:5173 (also on your LAN for phones)
npm test           # unit tests, once
npm run test:watch # unit tests, watch mode
npm run check      # typecheck + tests + data:check — gate every commit on this exiting 0
npm run data:check # garment data report: grade, warnings, errors, audit per garment
npm run photos     # cut product photos into public/garments/ (local only)
npm run build      # typecheck + production build
```
Logic that can be pure (geometry, form parsing, wording) lives in its own `.ts` file with
tests; components stay thin. localStorage keys are versioned (`nimbus.body.v1`): bump the
version when a stored shape changes. Keys today: `body`, `units`, `outfit` (fitting room),
`swipes` (one `{garmentId, sizeShown, liked, at}` per garment), `folders`, `outfits` (saved).

## Discover + Closet
- Navigation is a bottom `TabBar` (Fitting room / Discover / Closet) with plain state in
  `App.tsx`; the fitting-room outfit and the closet data live in `App` so any screen can
  put clothes on the mannequin.
- Discover feed (`buildFeed`): unseen garments in catalogue order, then passed ones oldest
  first; liked ones are left out. The feed is fixed when the screen opens; at the end it
  says there are no more garments. Cards show the recommended size, or the middle size
  (labelled as such) when `recommendSize` returns null.
- Unliking a garment or deleting an outfit removes it from every folder.
Python reference (repo root): `python -m pytest`, `python -m src.report --chest 38`.

## Working agreements
- Small steps, one commit per working piece; `npm run check` must pass before committing.
- If something is ambiguous, ask rather than guess.
