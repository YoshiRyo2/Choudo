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
- **No scraping.** Garment data comes from the hand-made seed file
  `app/src/domain/garments/seed.json`. Rows not taken from a real, cited size chart are
  marked `"placeholder": true`.

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
    garments/    schema types, seed.json, validator
    fit/         fitGarment(body, garment, size) -> per-zone fit results
  ui/            React
    screens/     BodyScreen (input), FittingRoom (browse + size + fit), Discover (swipe feed),
                 Closet + closet/ (Liked, Folders, Outfits tabs)
    components/  Mannequin/ (pure geometry.ts, topShape.ts, photoWarp.ts + SVG), SwipeCard/ (pure swipe.ts),
                 GarmentCarousel, SizePicker, FitReadout, FitSheet, Sheet (<dialog>), TabBar, NameForm,
                 ConfirmButton, TapeScale, SegmentedControl
    state/       usePersistentState (localStorage), stored.ts (keys + guards), outfit.ts,
                 feed.ts (likes/passes, feed order), closet.ts (folders, saved outfits), useCloset.ts
    fitText.ts   all user-facing fit wording
    styles.css   design tokens (colours, type scale)
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
- A size's overall result is never "good" when a girth couldn't be checked; it's "unknown"
  (unless something is definitely bad). `recommendSize` never picks a size on length alone.
- Stretch fabric moves the "tight" boundary (`STRETCH_ALLOWANCE` in `rules.ts`).
- Woven shirts currently use the tee chest thresholds — likely too strict; tune in `rules.ts`.

## Commands (run from `app/`)
```bash
npm install        # install
npm run dev        # dev server at http://localhost:5173 (also on your LAN for phones)
npm test           # unit tests, once
npm run test:watch # unit tests, watch mode
npm run check      # typecheck + tests — gate every commit on this exiting 0
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
