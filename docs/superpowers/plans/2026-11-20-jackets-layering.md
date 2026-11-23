# Jackets / coats + layering (PR 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit and draw jackets (a new `jacket` template in a new `outer` slot). In the Fitting room, a jacket worn over a top is fitted over that top ("with your hoodie under it") and drawn hanging off it. Size cards everywhere else stay bare-body.

**Architecture:**
- **Fit.** A pure `domain/fit/layers.ts` works out how much room the layer underneath takes. It uses `LAYER_BULK_CM` by weight, plus a kept share of that layer's spare chest ease.
- `fitGarment` / `fitAllSizes` / `sampleFit` take an optional `under` layer. The jacket's `layered` zones (chest, waist) compare against the body plus that allowance.
- The sampler computes the allowance inside each sample, from the same body draw, so the hoodie and the jacket move together.
- `fitOutfit` returns every layer's fit plus layer notes.
- **Drawing.** `templates/jacket.ts` builds an envelope `BodyGeometry` from the drawn top under it, then runs the unchanged `topShape` on it, so the jacket hangs off the hoodie.

**Tech Stack:** TypeScript, React, Vitest. Run everything from `app/`.

**Spec:** `docs/clothing-categories-design.md` §3 (layering) and §6 "PR 4 — jackets / coats", plus the task brief.

## Global Constraints

- Every new threshold is labelled **ASSUMED** in its doc comment. That covers layer bulk, kept ease, the jacket chest offset, the shoulder band and the length marks.
- Every existing golden line (`src/domain/fit/__golden__/*`) stays byte-identical. The new jackets only add lines, fitted bare-body.
- Skin rule: every jacket width and height comes from `domain/` numbers. Those are the chart, the body, the `layers.ts` allowance and bulk, and `tops.ts` lengths. The under-layer's drawn outline is itself skin over its chart.
- Without `under`, `sampleFit` makes exactly today's random draws. Under-layer offsets draw from their own streams (`keyedSeed(seed, 'under:' + key)`).
- No new body keys. No product photos: the jacket template has `landmarks: null`.
- Bump storage keys when a shape changes (`outfit`, `outfits` → v2) and migrate in `ui/state/migrate.ts`.
- `npm run check` must exit 0 before every commit.

## Decisions taken here (say if you want them otherwise)

1. **Slots.** Jackets get category `outer`. The layer under a jacket is whatever is in `top`: a tee, a shirt or a knit. There's no separate `mid` slot yet; three tops (tee + hoodie + jacket) can wait.
2. **Outfit v2 stays flat**: `{ topId, topSize, bottomId, bottomSize, outerId, outerSize }`. The design's `{ [slot]: {id,size} }` map would touch every outfit reader for one extra slot. Dresses (PR 5) can change it again.
3. **No bicep zone.** Neither sample chart prints one, and the body has no bicep key; adding one needs the ANSUR re-fit.
4. **Shoulder is optional.** It's scored only when a chart lists `shoulder`; neither sample does. Its rule is girth-kind (tight / fitted / relaxed / loose), so it reuses the existing verdict wording ("too tight", "roomier"). No new verdicts.
5. **Jacket length is a landing zone** (cropped / hip / thigh / knee / calf), measured against the hip line. Like every landing, it never decides the size.
6. **The outer slot starts empty.** Nothing puts a jacket on by default. A "Take off" button empties the slot.
7. **Pins.** When a jacket is on, the Mannequin shows the jacket's pins (and the bottom's), not the top's.

## Review Focus

1. **A jacket over a tee** comes out almost exactly as the jacket alone. A light layer adds no bulk, and a tee rarely has spare ease beyond fitted. Test in Task 2.
2. **The layer under it has an unknown girth method or no chest.** Its spare ease counts as 0; only the bulk is added. Test in Task 2.
3. **A short-sleeve top under a long jacket sleeve** gives no "cuffs show" note, and the envelope arm isn't widened. Tests in Tasks 2 and 6.
4. **A hoodie longer than the jacket** gives a "shows below" note, and the drawing shows it below the hem. Tests in Tasks 2 and 6.
5. **Size cards stay bare-body.** Discover and Closet tiles, `garmentOdds` without `under`, and the golden lines for jackets are all bare. Tests in Tasks 3 and 5.

---

### Task 1: Jacket template (fit, bare body)

**Files:**
- `domain/garments/types.ts`: `GarmentCategory` gains `'outer'`; `GarmentType` gains `'jacket' | 'coat'`.
- `garments/categories.ts`: `TemplateId` gains `'jacket'`, plus a `CATEGORY_SPECS.jacket` stub.
- `fit/rules.ts`, `fit/zones.ts`, `fit/preference.ts`.
- Test: `fit/jacket.test.ts`.

**Interfaces — produces:**
- `JACKET_EASE_OFFSET_CM = 13`. ASSUMED from J317: its flat chest × 2 minus the size chart's mid chest is about 17.8 cm on M–XL, against the tee regular target of +5.
- `JACKET_GIRTH_RULES: Record<GarmentSizing, GirthRule>`: the top chest rules shifted by the offset, as `knitChest` does.
- `JACKET_SHOULDER: GirthRule` = `{ tightBelow −1.5, fittedMax 1.5, relaxedMax 4, ideal 0 }`. ASSUMED: "the seam on the shoulder point ±1.5 cm".
- `JACKET_LENGTH: LandingRule`, marked against length − torso (0 = the hip line): `cropped −∞, hip −6, thigh +12, knee +32, calf +45`. ASSUMED: the hip line to the crotch is about 10 cm, and to the knee about 35–39 cm.
- `ZoneId` gains `'shoulder'`. `ZoneSpec` gains `layered?: true`.
- `TemplateZones.personal.length` becomes `ZoneId | null`.
- `JACKET_ZONES`, in this order:
  - chest: layered, `bySizing` `JACKET_GIRTH_RULES`.
  - waist: layered; applies when the size has a waist; `bySizing` (jacket rules).
  - shoulder: optional, `shoulderWidthCm`.
  - sleeve: long only; `shoulder_to_cuff` or `center_back_to_cuff`, via `sleeveTargetCm`, `bodyAt` `centre_back`.
  - length: landing; `lengthTargetCm` (hps / cb); needs length ∈ `['hps', 'center_back']`.
- Personal: `{ girth: 'chest', length: null, easeOffsetCm: JACKET_EASE_OFFSET_CM }`.
- Jackets are never anchors: `canAnchor` returns false for the `jacket` template.

- [ ] Test: a jacket fixture (chest flat, hps length, cb sleeve) on men's 176/85 gives zones `chest, shoulder, sleeve, length` in that order. The waist is filtered out by `applies`, and the shoulder is unknown with `optional`. The length is a landing with `landing: 'hip'` at diff +0.5. Thigh, knee and calf come out at the mark boundaries.
- [ ] Test: an overall result ignores the length landing, and a missing shoulder doesn't make the size unknown.
- [ ] Test: a men's chest at +18 cm ease reads `relaxed`. The personal target is the tee target + 13.
- [ ] Test: `canAnchor(jacket)` is false.
- [ ] Run `npx vitest run src/domain/fit/jacket.test.ts src/domain/fit/golden.test.ts`. The golden test must still pass unchanged (no seed rows yet).
- [ ] Commit.

### Task 2: Layering engine

**Files:**
- `domain/fit/layers.ts` (new), `fitEngine.ts`, `index.ts` exports.
- Test: `fit/layers.test.ts`.

**Interfaces — produces (`fit/layers.ts`):**
- `LAYER_BULK_CM: Record<GarmentWeight, number>` = light 0.5, mid 2, heavy 3.5 (ASSUMED, from the design §3.1).
- `OUTER_ASSUMES: GarmentWeight = 'light'`, and `UNDER_EASE_KEPT = 0.25` (ASSUMED).
- `interface UnderLayer { garment: Garment; sizeLabel: string }`.
- `layerAllowanceCm(body: BodyMeasurements, under: UnderLayer): { chestCm: number; waistCm: number }`:
  - bulk = max(0, bulk(weightOf(under)) − bulk(light)).
  - spare = max(0, under chest − body chest − the under zone's chest `fittedMax` in cm). It's 0 when the under chest is unknown or unscorable.
  - chest = bulk + UNDER_EASE_KEPT × spare; waist = the same (a top hangs straight, ASSUMED).
- `layerGrowCm(under: Garment): number` = bulk(weightOf(under)) / 2π. This is the drawing's growth per side.
- `fitGarment(body, garment, sizeLabel, under?: UnderLayer)` and `fitAllSizes(body, garment, under?)`.
  - Layered zones add the allowance to `bodyCm` and set `bodyAt: 'over_layer'` (a new `BodyAt`), with source estimated.
  - The result gains `over?: { garmentId: string; type: GarmentType }`.
  - `under` is ignored for templates without layered zones.
- `type LayerNote = { kind: 'hem-shows' | 'cuffs-show' | 'bunches'; cm: number }`.
- `fitOutfit(body: BodyModel, worn: { top?: UnderLayer; bottom?: UnderLayer; outer?: UnderLayer }): { top?: GarmentFit; bottom?: GarmentFit; outer?: GarmentFit; notes: LayerNote[] }`.
  - top and bottom are fitted bare; outer is fitted over top.
  - **hem-shows**: the top's `hpsLengthCm` exceeds the outer's by more than 1 cm.
  - **cuffs-show**: both sleeves are long and the top's reach from the shoulder point exceeds the outer's by more than 1 cm. A new `sleeveReachCm` in `tops.ts` gives the reach: the shoulder-to-cuff sleeve as charted, or `sleeveFromShoulderPointCm`.
  - **bunches**: the top's chest − body > the outer's chest − (body + allowance).

- [ ] Tests:
  - A hoodie (mid) under the jacket adds 1.5 cm + 0.25 × spare.
  - A tee (light, little ease) adds about 0.
  - An unknown under girth adds the bulk only.
  - A heavy layer adds 3.
  - `fitGarment` with `under` raises the chest `bodyCm` by the allowance and sets `bodyAt` and `over`.
  - `fitGarment` without `under` is deep-equal to today's.
  - Each note fires and doesn't fire (a short-sleeve tee gives no cuffs note).
- [ ] Commit.

### Task 3: Sampler with one shared body draw

**Files:**
- `fit/sampleFit.ts` (`SampleOptions.under?: UnderLayer`), `ui/state/odds.ts` (the cache key includes the under id and size).
- Test: `fit/sampleFit.test.ts`.

- [ ] Test: with `under`, each sample computes the allowance from that sample's drawn body, and the under garment's offsets come from its own streams.
  - Odds stay deterministic.
  - A body-chest-only change moves the hoodie ease and the jacket's effective chest together: the jacket's odds change less than with an independent draw.
  - `sampleFit` without `under` equals the golden.
- [ ] Test: `recommendSize` and `measurementHint` pass `under` through.
- [ ] Implement. The under garment's offsets are drawn after all of today's draws in a sample, from `keyedSeed(seed, 'under:' + key)` streams.
- [ ] Commit.

### Task 4: Data checks + seed rows

**Files:**
- `categories.ts` (`CATEGORY_SPECS.jacket`), `verifyRules.ts`, `validate.ts`, `seed.json`.
- Tests: `garments/jacket.test.ts`, regenerated golden.

**Data checks:**
- `CATEGORY_SPECS.jacket`:
  - category `outer`; required `chest, length`; `JACKET_RANGES`.
  - `JACKET_RANGES` (ASSUMED): chest 85–190, length 50–125, shoulder 38–62, sleeve by definition (shoulder-to-cuff 50–80, centre back 70–105).
  - knit-style girth-method limits (flatMax 95).
  - `lengthDefinitions` and `scoredDefinitions` as knits; `defaultWeight: 'mid'`; `landmarks: null`.
- `validate.ts`: the top-only checks become torso checks (top or outer). These are the length definition requirement, topOrder, and the "no ankle zip" rule.

**Seed rows (tier B, SanMar spec sheets as published, `capturedOn` the day of capture):**
- `port-authority-j317`: Port Authority Core Soft Shell Jacket J317, https://www.sanmar.com/p/5503/specSheetMeasurements.
  - XS–6XL, in; chest laid flat 1 in below the armhole.
  - `definitions.length: 'hps'` ("high point shoulder to finished hem at back"); sleeve `center_back_to_cuff`.
  - `sizing: 'mens'`: the size chart's chests are men's (M 38–40); L317 is its women's cut.
  - Stretch `some` (its heather shell is 8 % spandex), `fitIntent: 'regular'`, weight `mid` (microfleece lining).
- `port-authority-l317`: Ladies Core Soft Shell Jacket L317, https://www.sanmar.com/p/5504/specSheetMeasurements. XS–4XL, bust flat, the same definitions, `sizing: 'womens'`.
- Snapshots go in `app/chart-snapshots/` (git-ignored). The page has no date.
- Units aren't printed on the page; they're inches by the size chart. Say so in `notes`.

- [ ] Tests:
  - The ranges and the flat limit warn.
  - A jacket without a length definition grades `unscored`.
  - `ankleZip` on a jacket is an error.
  - A jacket with category `top` is an error.
  - Both rows grade `charted` with no warnings.
- [ ] Run `npm run data:check`. Run `npx vitest run src/domain/fit/golden.test.ts -u` and confirm the diff only adds lines.
- [ ] Commit.

### Task 5: Outfit v2 + Fitting room layering (no new drawing yet)

**Files:**
- `ui/state/stored.ts` (`outfit` / `outfits` → v2, `Outfit` gains `outerId/outerSize`), `migrate.ts`, `outfit.ts`.
- `screens/FittingRoom.tsx`, `components/FitReadout.tsx`, `FitStrip`.
- `fitText.ts`, `catalogueText.ts`, `GarmentIcon.tsx`, `SwipeCard.tsx`, `closet/LikedTab.tsx`, the Outfits tab.

**Storage:**
- `migrateOutfitV1(v)` adds `outerId: null, outerSize: null`, for the stored outfit and every saved outfit. Old `nimbus.*` v1 keys chain through, as body v1 does.
- `resolveOutfit`: an outer is never picked by default; a stale outer id becomes null. `wearGarment` puts an outer in `outer`.

**Fitting room:**
- The SegmentedControl shows Top / Bottom / Jacket.
- When an outer and a top are worn, the outer's `fits`, `fit` and `odds` come from `fitAllSizes(..., under)` and `garmentOdds(..., under)`.
- Browsing Jacket shows a "Take off" button while one is worn.

**fitText:**
- `ZONE_NAME.shoulder` 'Shoulders' and `ZONE_PLACE` 'at the shoulders'.
- `LANDING_TEXT` for cropped / hip / thigh / knee / calf.
- `describeZone`: the jacket length reads "Hip length: the hem ends N cm below your hip line".
- `bodyPlaceText` for `over_layer` reads " with your hoodie under it".
- `wornOverText(fit)` reads "With your hoodie under it". It takes the type noun from `GarmentType` (hoodie, sweatshirt, sweater, cardigan, tee, shirt for a button-up, polo).
- `layerNoteText(note, under, outer)`:
  - "Your hoodie shows 6 cm below the jacket's hem."
  - "Your hoodie's cuffs show past the jacket sleeves."
  - "Your hoodie is roomier than the jacket: expect it to bunch up underneath."
- The phrases that read `category === 'top'` now read `category !== 'bottom'`, so jackets get the personal wording. Existing wording is unchanged.

**FitReadout:**
- Shows `wornOverText` under the heading, plus the notes, when `fit.over` is set.

**Elsewhere:**
- Discover cards, Liked and Outfits tiles draw a jacket bare, from its own bare odds.
- The Liked filter gains Jackets. GarmentIcon draws a jacket.

- [ ] Tests:
  - v1 → v2 migration for both keys; guards.
  - `resolveOutfit` keeps the outer empty.
  - `wearGarment` puts an outer in its slot.
  - fitText strings for each new phrase, with the hoodie and tee nouns.
  - `wornOverText` is null without `over`.
- [ ] Commit.

### Task 6: Drawing — the jacket hangs off the layer under it

**Files:**
- `ui/components/Mannequin/templates/jacket.ts` (new) + test, `Mannequin.tsx`, `topShape.ts`.
- In `topShape.ts`, only the neckline dip for jacket types changes. The tee and knit snapshots stay unchanged.

**Interfaces — produces:**
- `envelopeGeometry(g: BodyGeometry, under: TopShape | null, growCm: number): BodyGeometry`.
  - From the HPS to the under hem, the outline's x is max(body, under side seam) + grow.
  - `half.chest`, `half.waist` and `half.hip` are read off the new outline; `half.shoulder` = max(body, under seam x) + grow.
  - When the under sleeve is long, the arm half-widths grow by the under sleeve's room + grow.
  - With `under === null` it returns `g` unchanged.
- `jacketShape(g, body: BodyMeasurements, garment, size, under: { shape: TopShape; layer: UnderLayer } | null): TopShape & { placket: string }`.
  - It calls `topShape(envelopeGeometry(...), garment, size, body.chestCm + layerAllowanceCm(...).chestCm, body)`.
  - `placket` is a centre-front line from the neckline to the hem: the jacket drawn closed.
- Mannequin gains `outer?: WornGarment`. The draw order is hood → body → bottom → top → jacket body, placket, arms, sleeves.
  - The top's arm overlay is skipped when an outer is worn.
  - With an outer, the pins are the outer's (right side) and the bottom's.
  - The aria label adds "with X over it".

- [ ] Tests:
  - With no under layer the envelope equals `g`.
  - A hoodie under it makes the jacket's side seam at chest height ≥ the hoodie's + grow.
  - A tee under it leaves the jacket within 0.5 cm of the jacket drawn alone.
  - A hoodie longer than the jacket keeps the hoodie hem y below the jacket hem y.
  - A short-sleeve tee doesn't widen the envelope arm.
  - The jacket hem y equals `g.y.hps + hpsLengthCm × DRAPE` (skin).
  - `topShapeGuard` snapshots are unchanged.
- [ ] Commit.

### Task 7: Test mode

**Files:** `ui/state/fitTests.ts`, `stored.ts`, `screens/FitTestPanel.tsx`, `domain/fit/fitTestCsv.ts`, `fitTestReport.ts`.

- An outer records chest and length answers like a top, with `category: 'outer'` and `wornOver: garmentId | null`.
- The guard accepts `'outer'`, a widening, so v3 records still read and the key isn't bumped.
- The CSV gains a last column, `worn_over`. The report groups outer rows with tops for chest.
- The prediction uses the layered odds when there's something under it.
- [ ] Tests: CSV round-trip with and without `worn_over`; old v3 records still parse; the report counts outer chest rows.
- [ ] Commit.

### Task 8: Docs, browser check, PR

- [ ] Update `CLAUDE.md`:
  - the layout (`layers.ts`, `templates/jacket.ts`);
  - the fit rules (jackets, layering);
  - the storage keys (outfit v2, outfits v2);
  - garment data (the jacket checks and rows).
- [ ] Add "PR 4 as built" to the design doc, with the decisions above and the follow-ups: bicep, a `mid` slot, open jackets, the jacket photo warp. Add a jacket line to `docs/adding-garments.md`.
- [ ] Run `npm run check`, then `npm run build && npm run dist:check`.
- [ ] Browser preview, men's 176/85, Gildan 18500 L + J317 L. Screenshot the Fitting room with the jacket over the hoodie and the readout saying "With your hoodie under it". Screenshot it over a tee, and a Discover jacket card (bare). Copy the screenshots to the notes folder.
- [ ] Rebase on `main` (the polish-photo-thumbs PR may have landed in FittingRoom and the Mannequin). Re-run check, review the diff for `node_modules` and caches, push, and open the PR via `~/bin/gh`, ending with the attribution line.
