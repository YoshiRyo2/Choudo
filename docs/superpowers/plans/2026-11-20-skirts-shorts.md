# Skirts / shorts (PR 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit and draw shorts (the pants template with the inseam as a landing zone) and skirts (a new template: waist at the band, hips at a drop, length landing, walking room), with data checks and two real seed rows.

**Architecture:** Two new `TemplateId`s, `shorts` and `skirt`, both category `bottom`. Shorts reuse the pants zones (waist at the band, hips, thigh, rise) and swap the inseam for a landing zone measured from the crotch against the knee; skirts get their own zones in `domain/fit/zones.ts` with the body numbers worked out in a new pure `domain/fit/skirt.ts` (band height, hip-point height, hem height, stride girth). The drawing reuses `pantsShape` for shorts and adds `templates/skirt.ts`, reading the same `domain/fit/skirt.ts` functions (skin rule).

**Tech Stack:** TypeScript, React, Vitest. Run everything from `app/`.

**Spec:** `docs/clothing-categories-design.md` §6 "PR 3 — skirts / shorts", plus the task brief (marks: shorts mid-thigh / above knee / knee; skirt mini / above knee / knee / midi / maxi).

## Global Constraints

- Every new threshold is labelled **ASSUMED** in its doc comment.
- Every existing golden line (`src/domain/fit/__golden__/*`) stays byte-identical; new garments only add lines.
- Skin rule: every drawn height/width comes from a `domain/` function or the chart.
- New measurement keys go at the end of `MEASUREMENT_KEYS`; no new body keys.
- No product photos: skirt and shorts templates take no landmarks (`landmarks: null`).
- `npm run check` must exit 0 before every commit.

## Review Focus

1. A skirt chart with no `definitions.waist` (or `unknown`) — band sits at the navel, as pants without a rise; length/hips/walking still compute. Test in Task 2.
2. A hem below the floor (very long maxi on a short body) — landing says maxi, drawing clamps the hem above the floor. Test in Task 5.
3. A skirt hem above the crotch (micro mini) — stride girth uses no stride (d = 0), never negative. Test in Task 2.
4. Shorts whose inseam reaches past the knee — landing reads "knee", drawing still draws a knee point between thigh and hem. Test in Task 1/5.
5. Pants are untouched: `PANTS_ZONES` still has the inseam *length* zone and leg opening. Golden test covers it.

---

### Task 1: Shorts template (fit)

**Files:** `src/domain/garments/types.ts`, `categories.ts`, `verifyRules.ts`; `src/domain/fit/rules.ts`, `zones.ts`, `shorts.ts` (new); tests `src/domain/fit/shorts.test.ts`.

**Interfaces — produces:**
- `GarmentType` gains `'shorts' | 'skirt'`; `TemplateId` gains `'shorts' | 'skirt'`; `TYPE_TEMPLATE.shorts = 'shorts'`, `.skirt = 'skirt'`.
- `BodyAt` gains `'knee'` (a distance to the knee) and `'stride'`.
- `SHORTS_INSEAM: LandingRule` marks `[mid-thigh −∞, above-knee −12, knee −4]` (cm, garment inseam − crotch-to-knee). ASSUMED (5–7 in inseams mid-thigh, 9 in above knee, 11 in at the knee on a ~30 cm crotch-to-knee).
- `crotchToKneeCm(m: BodyMeasurements): number` = `inseamCm − kneeHeightCm` in `fit/shorts.ts`.
- `SHORTS_RANGES` in verifyRules (inseam 5–35, legOpening 40–100, rest as BOTTOM_RANGES).

- [ ] Test: `fitGarment` on a shorts fixture (inseam 14 cm, front rise) for women's 163/68 gives zones `waist, hips, thigh, rise, inseam` in order; inseam `kind: 'landing'`, `landing: 'mid-thigh'`, `bodyAt: 'knee'`, `bodyCm = inseamCm − kneeHeightCm`. 23 cm inseam → `above-knee`; 30 cm → `knee`.
- [ ] Test: shorts overall ignores the inseam landing (a size with good waist/hips is `good`).
- [ ] Implement; run `npx vitest run src/domain/fit/shorts.test.ts`, then full golden.
- [ ] Commit.

### Task 2: Skirt template (fit)

**Files:** `types.ts` (`LengthDefinition` + `'waist'`; `WaistDefinition = 'natural' | 'mid' | 'low' | 'unknown'`; `Definitions.waist`; `hemSweep` measurement + girth key; `chart.hipsBelowWaist?: number`; `Garment.hipsBelowWaistCm?`), `normalize.ts` (keys), `garments.ts` (hipsBelowWaist → cm), `fit/rules.ts`, `fit/skirt.ts` (new), `fit/zones.ts`, `fit/fitEngine.ts` (landing mark tone).

**Interfaces — produces (fit/skirt.ts):**
- `SKIRT_BAND_DROP_CM: Record<WaistDefinition, number>` = natural 0, mid 4, low 8, unknown 0 (cm below the navel). ASSUMED (matches the pants RISE marks: high within 1.5 cm, mid about 5 cm down).
- `skirtBandHeight(m, g): number`, `skirtHipHeight(m, g): number` (band − hipsBelowWaistCm, or the body's hip line without one), `skirtHemHeight(m, g, s): number` (band − length).
- `legGirthAt(m, heightCm): number` (thigh at crotch → knee girth at knee height → calf below).
- `strideGirthCm(m, hemHeightCm): number` = legGirth + 2·√(D_lat² + D_sag²), D_lat = legGirth/π, D_sag = 2·sin(θ/2)·max(0, inseamCm − hem). `STRIDE_ANGLE_DEG = 40` ASSUMED (hip flexion ~30° + extension ~10° in normal gait). Above the crotch: the body girth at that height.
- Rules: `SKIRT_LENGTH: LandingRule` marks `[mini −∞, above-knee −15, knee −5, midi +5, maxi +28]` on length − (band − knee height); `WALKING_ROOM: LandingRule` marks `[restricted −∞ tone warn, free 0]`. Both ASSUMED.
- `LandingRule.marks[i].tone?: 'warn'` — fitZone gives that tone when the mark is reached (still never counts in overallTone).
- Skirt zones: `waist` (BOTTOM_WAIST, bodyAt band), `hips` (BOTTOM_HIPS, bodyAt band when hipsBelowWaist), `length` (landing, needs length ∈ ['waist'], bodyAt knee), `walkingRoom` (garmentKey hemSweep, landing, optional, applies when the size has a length, bodyAt stride).

- [ ] Tests (`fit/skirt.test.ts`): band height by definition; hip height with/without drop; strideGirth ≥ legGirth·(1+2/π) at d = 0 and grows with d; hem above crotch → no stride; skirt fixture: zones in order, length landing marks (mini → maxi at chosen lengths), walking `restricted` tone `warn` and overall unaffected; no waist definition → band at navel.
- [ ] Implement; run tests + golden.
- [ ] Commit.

### Task 3: Data checks

**Files:** `categories.ts` (CATEGORY_SPECS shorts, skirt), `verifyRules.ts`, `verify.ts`, `validate.ts`; tests in `garments/skirtShorts.test.ts`.

- Shorts: required `waist, inseam`; `SHORTS_RANGES`; relations `legOpening ≤ thigh`, `thigh ≤ MAX_THIGH_TO_HIPS × hips`; labelEase `waist`; lengthDefinition forbidden.
- Skirt: required `waist, length`; `SKIRT_RANGES` (waist 55–150, hips 75–170, length 30–130, hemSweep 70–400) ASSUMED; relation `waist ≤ hips`; labelEase null; `lengthDefinition: 'required'` with `scoredDefinitions.length = ['waist']`; `chart.hipsBelowWaist` 5–30 cm and below every size's length (warning); `GIRTH_METHOD_LIMITS.hemSweep` flatMax 120 / circumferenceMin 70.
- validate: `LENGTH_DEFINITIONS` per template (tops hps/center_back/unknown, skirt waist/unknown); `hipsBelowWaist` must be a positive number and only on skirts; the photo message stays.
- [ ] Tests: each relation and range warns; skirt without length definition is `unscored`; tops still reject `waist` as a length definition; `hipsBelowWaist` on pants is an error.
- [ ] Implement, `npm run data:check`, commit.

### Task 4: Seed rows

- `landsend-a-line-skirt` (430808, Regular 0–16, inches, circumference, length `waist` (centre back from the waistband), waist `mid` (retailer copy: "midrise"), stretch none, womens, tier B).
- `landsend-easy-shorts` (552171, Men's 5½" Lightweight Twill Easy Shorts, S–XXL, waist relaxed, stretch `{ default: none, waist: high }`, rise front, legOpening = bottom opening, mens, tier B).
- Snapshots copied to `app/chart-snapshots/` (git-ignored). Regenerate golden (`-u`), confirm only added lines.

### Task 5: Drawing

**Files:** `ui/components/Mannequin/templates/skirt.ts` (new) + test, `Mannequin.tsx` (pick by template), `templates/pants.ts` (shorts markers unchanged; inseam pin at hem).

- `skirtShape(g, body, garment, size): SkirtShape` — `{ body: string; markers: { waist, hips, length, walkingRoom }; hemY: number; approximate: boolean }`. Band y = H − skirtBandHeight; hip y = H − skirtHipHeight; hem y = H − skirtHemHeight clamped to floor − 0.5; widths from chart (`halfWidth.waist/hips`; hem from hemSweep via `halfWidth.hips`), never inside the body (`bodyHalfAt + 0.5`); no hemSweep → straight from the hips, dashed.
- Mannequin: `templateOf(bottom) === 'skirt' ? skirtShape : pantsShape`; skirts drawn after the legs. 
- [ ] Tests: hem y equals `H − skirtHemHeight`; band y equals `H − skirtBandHeight`; hem below the floor clamps; A-line wider at hem than pencil.
- [ ] Commit.

### Task 6: Wording, icon, Test mode

- `fitText.ts`: ZONE_NAME/ZONE_PLACE `walkingRoom` ('Walking room', 'at the hem'); LANDING_TEXT for every new mark; describeZone: inseam landing / skirt length "Hem ends N cm above/below your knee", walking room "N cm short of a full stride: expect shorter steps" / "Room for a full stride"; `bodyPlaceText` for knee/stride.
- `GarmentIcon`: skirt and shorts shapes. Test mode: length question uses the zone that exists.
- [ ] Tests in `fitText.test.ts`. Commit.

### Task 7: Docs, browser check, PR

- CLAUDE.md + design doc "PR 3 as built" + adding-garments; `npm run check`; screenshots of skirt and shorts in the Fitting room; PR via `~/bin/gh`.
