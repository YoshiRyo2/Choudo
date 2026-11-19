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
- **No face, no photo, no camera.** Body input = height + weight + body type ("Size me in
  women's / men's clothes"), plus optional chest (full bust) / waist / hips / inseam
  overrides and, for a women's body, an optional bra size.
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
    body/        estimateBody(input) -> BodyModel (men's power law; women's ANSUR II regressions),
                 braSize.ts (parse "34DD", US/UK cups, bust estimate)
    garments/    types.ts (schema), seed.json, normalize.ts (printed -> cm + provenance),
                 validate.ts (structure), verify.ts + verifyRules.ts (stage-5 checks),
                 grade.ts (confidence grade), report.ts (npm run data:check text),
                 catalogue.ts (garments for a body type: its sizing + unisex, or all)
    fit/         fitGarment(body, garment, size) -> per-zone fit results (rules.ts thresholds)
                 preference.ts (anchor tee / fit style -> personal verdict), sampleFit.ts
                 (seeded odds, recommendSize, measurementHint), uncertainty.ts (every spread),
                 random.ts, fitTestCsv.ts + fitTestReport.ts (npm run fit:report)
  ui/            React
    screens/     BodyScreen (input), AnchorScreen (fit reference), FittingRoom (browse + size + fit),
                 FitTestPanel (Test mode), Discover (swipe feed), Closet + closet/ (Liked, Folders, Outfits tabs)
    components/  Mannequin/ (pure geometry.ts, topShape.ts, photoWarp.ts + SVG), SwipeCard/ (pure swipe.ts),
                 GarmentCarousel, GarmentBadge, SizePicker, FitReadout, FitSheet, Sheet (<dialog>), TabBar, NameForm,
                 ConfirmButton, TapeScale, SegmentedControl, NumberInput
    state/       usePersistentState (localStorage), stored.ts (keys + guards), outfit.ts,
                 feed.ts (likes/passes, feed order), closet.ts (folders, saved outfits), useCloset.ts,
                 odds.ts (cached sampleFit), fitTests.ts (Test mode records + CSV)
    fitText.ts   all user-facing fit wording
    styles.css   design tokens (colours, type scale)
  dev/landmarks/ dev-only landmark picker (/dev/landmarks): suggest.ts (landmarks from the
                 outline), seedWrite.ts (writes one "image" into seed.json), pickerModel.ts
app/dev/       landmarks.html + landmarksServer.ts: the picker page and its save endpoint,
               Vite dev server only (apply: 'serve'), never in npm run build
app/scripts/   data-check.mjs (npm run data:check), fit-report.mjs (npm run fit:report),
               garment-photos.mjs (npm run photos: AI cut-out via photo-model.mjs, BiRefNet-lite,
               MIT; mask clean-up in photo-mask.mjs). Model weights download to app/.models/
app/chart-snapshots/, app/photo-sources/   local copies of charts and photos, git-ignored
docs/          adding-garments.md (checklist for adding a garment by hand)
data/fit_tests.csv    (repo root) fit-test results, pasted from Test mode's CSV export.
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
- Top chest/waist thresholds go by the **garment's** sizing (`TOP_GIRTH_RULES`): women's cuts use
  `WOMENS_TOP_CHEST` (fitted to +1 in, relaxed to +3 in — assumed, not sourced yet); men's and
  unisex keep the men's numbers on any body. Bottoms use one set for everyone.
- One chest zone in the engine; `fitText.ts` calls it **Bust** for a women's body
  (`zoneName`, `describeZone`, `summarize`, `measureHintText`; `GarmentFit.bodyType`).

## Body estimates (source of truth is `domain/body/`)
- `bodyType: "womens" | "mens"` on the body input (men's is the default and v1's).
- Men's girths: power law from an ANSUR II-rounded reference body (unchanged since v1).
- Women's bust, waist, hips and inseam: least-squares on height and weight over the ANSUR II
  female public data (1,986 women), each coefficient cited with R² and residual SD in
  `estimateBody.ts`; results are clamped to `INPUT_LIMITS`. ANSUR II's waist is at the navel.
- Bust, best first: measured full bust → bra size (band + cup inches, A = 1; US and UK letters
  differ after D) → height + weight. A bra-size bust stays "estimated" (`BodyModel.bra`) with
  its own spread (`BRA_BUST_SD_CM`).
- A cup above C widens the torso-length spread (`CUP_TORSO_SD_CM_PER_IN`) — an assumption,
  never a shift in the length itself.

## Personal fit and odds (source of truth is `domain/fit/`)
- Zone labels stay objective. The **verdict** is personal: fits how you like / a bit snugger /
  roomier / much roomier / too tight / shorter / longer / "as designed" / unknown.
- Preference: an anchor tee (catalogue garment + size, or measured flat) beats a stated style
  (Slim / Regular / Relaxed / Oversized) beats the Regular default. Anchors are stored as entered
  and worked out against the current body; an anchor's ease is turned into its regular-cut
  equivalent. Targets and bands per style / fitIntent are `INTENT_EASE` in `rules.ts`.
- Relaxed and oversized designs win when their ease is above the user's ("Oversized, as
  designed"); slim and regular cuts are sized to the user. Pants have no personal target yet.
- `sampleFit` draws body, garment and preference 500 times (seed fixed) and returns per-size
  label, personal and verdict odds. Every spread is in `uncertainty.ts`, each with its source;
  estimated body spreads are per body type (women's from the ANSUR II residuals).
  One body draw is shared by all sizes and the anchor, so an anchor cancels chest-estimate error.
- `recommendSize` = highest chance of "fits how you like"; ties go roomier; still null for
  unscored garments or with no girth to score. `measurementHint` names the estimated
  measurement that, measured, could change the size.
- Verdict wording thresholds (Very likely ≥ 75%, Probably ≥ 50%, else Might; close call
  within 15 points, both ≥ 25%) are in `fitText.ts`.

## Garment data rules (source of truth is `domain/garments/`)
- Garments live in `app/src/domain/garments/seed.json`. To add one by hand, follow
  `docs/adding-garments.md`.
- Every real row has a source tier (A brand spec … G photo only), `url`, `capturedOn`, and
  optionally a `snapshot` of the chart. Placeholders have `placeholder: true` and no tier.
- Seed values are copied as printed. A value is a plain number (from the chart) or
  `{ value, origin: chart | estimated | audited, how }`. `normalizeGarment` converts to cm
  and keeps each value's origin, printed number and conversions (`GarmentSize.provenance`).
- Every row has `sizing: "mens" | "womens" | "unisex"` (who the chart is cut for). Gildan 5000
  and Knightweave are unisex. The Fitting room and Discover show the body type's sizing plus
  unisex, with a shared "Show: … & unisex | All" toggle (`catalogueFor`); a worn garment
  stays on even when hidden.
- `checkGarment` (stage 5) returns errors and warnings. Errors leave the garment out of the
  catalogue and fail `npm run data:check`: a sizing other than the three above, a size smaller
  than the one before, or a flat girth that looks like a full circumference (or the reverse). Warnings need review:
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
npm run fit:report # fit-test report from ../data/fit_tests.csv (or a path after --)
npm run photos     # cut garment photos out into public/garments/ (local only)
                   # then place landmarks at http://localhost:5173/dev/landmarks?id=<garment>
npm run build      # typecheck + production build
```
Logic that can be pure (geometry, form parsing, wording) lives in its own `.ts` file with
tests; components stay thin. localStorage keys are versioned (`nimbus.body.v2`): bump the
version when a stored shape changes, and move old data in `ui/state/migrate.ts` (runs once at
start-up). Keys today: `body` (v2: `bodyType`, optional `braSize`), `units`, `outfit` (fitting
room), `swipes` (one `{garmentId, sizeShown, liked, at}` per garment), `folders`, `outfits`
(saved), `anchor` (tee the user likes), `fitStyle`, `catalogue` (`matching` | `all`),
`testMode`, `fitTests` (v2, Test mode results; the CSV column stays `sizing`).

## Discover + Closet
- Navigation is a bottom `TabBar` (Fitting room / Discover / Closet) with plain state in
  `App.tsx`; the fitting-room outfit and the closet data live in `App` so any screen can
  put clothes on the mannequin.
- Discover feed (`buildFeed`): unseen garments in catalogue order, then passed ones oldest
  first; liked ones are left out, and only garments the catalogue toggle shows. The feed is
  fixed when the screen opens (or the toggle changes); at the end it says there are no more
  garments, offering Show all when the toggle hides some. Cards show the recommended size, or the middle size
  (labelled as such) when `recommendSize` returns null.
- Unliking a garment or deleting an outfit removes it from every folder.
Python reference (repo root): `python -m pytest`, `python -m src.report --chest 38`.

## Working agreements
- Small steps, one commit per working piece; `npm run check` must pass before committing.
- If something is ambiguous, ask rather than guess.
