# Clothing categories beyond tees — design report

Status: proposal, written 2026-11-19 against `main` @ `0060dee` (after PRs #27–#32). Decisions on the open
questions are at the end (2026-11-20). PR 1a (registry + rules, commits 1–2 of §6) is built; see "PR 1a as built".
Order asked for: pants/jeans → hoodies/sweaters → skirts/shorts → jackets/coats → dresses → bras → leggings
(the PR plan in §6 puts bras before leggings, as requested for the PRs).

**The rule this design keeps**, in short (the full wording is in [parked-ideas.md](parked-ideas.md)):

> Body proportions come only from the fit engine; drawing is a skin on top.

In practice: every length, height and girth the mannequin uses must be a number that `domain/` produced
(`BodyModel`, `Garment`, or a fit/layer result). `ui/` may shape (curves, folds, mirroring, colour), never
invent a proportion that a fit zone could disagree with. §1.4 lists where today's code breaks this, and PR 1 fixes the
pants-related cases.

---

## 1. Current state: how tee-specific is each part?

| Part | Tee-specific? | In one line |
|---|---|---|
| Garment schema | **Medium** | Bottoms exist, but the measurement set, the definitions and the photo landmarks are a closed, tee-shaped list. |
| `rules.ts` | **Medium–high** | Objective bands are generic in shape; personal fit (`INTENT_EASE`, anchors) is tee chest only; no negative-ease targets. |
| `recommendSize` | **Low in the picker, high in the scoring** | `pickSize` is generic; what feeds it (`personalFit`, miss, keys) switches on `category === 'top'`. |
| Mannequin rendering | **High** | Two hard-coded slots, tee physics in `topShape`, pants drawn partly from invented proportions. |
| Photo warp | **Math generic, mesh tee-only** | The triangle warp works for any mesh; the 13 landmarks and the triangle fan are a tee. |

### 1.1 Garment data schema — `app/src/domain/garments/types.ts`

- `GarmentCategory = 'top' | 'bottom'` (`types.ts:12`) and the eight `GarmentType`s (`types.ts:14`). Both are read
  as switches in about 30 places (`grep "category ==="`): `fitEngine.ts:118`, `sampleFit.ts:139,220,291`,
  `preference.ts:84,263`, `validate.ts:35,87,136`, `verify.ts:221,230,236,246`, `outfit.ts:41–48`,
  `FittingRoom.tsx:75–234`, `fitText.ts:299,342,402`, `LikedTab.tsx:32–60`, `SwipeCard.tsx:94`, `GarmentIcon.tsx:8`.
- `SizeMeasurements` (`types.ts:84`) is a fixed list: chest, waist, hips, length, sleeve, shoulder, inseam, rise.
  It has no **thigh, knee, leg opening, hem sweep, underbust, band, cup, bicep or back length**. `rise` is in
  the seed for 4 pants but no zone reads it.
- Measurement definitions exist only for tops: `LengthDefinition` (`hps | center_back | unknown`, `types.ts:48`)
  and `SleeveDefinition` (`types.ts:40`). Pants have no rise definition (front, back or total) and no thigh
  definition (at the crotch, or 1 in below it).
- `chart.girth` is **one method for the whole chart** (`SeedGarment.chart`, `types.ts:228`). Pants charts often
  print the waist all the way round but the thigh and leg opening flat, so this has to become per measurement.
- `stretch` is **one value for the whole garment** (`types.ts:219`). The Fieldline jogger is `high` because of its
  elastic waist, and that wrongly makes its hips stretchy too.
- `sleeve?: 'short' | 'long'` (`types.ts:218`) is a top field that sits on the shared base.
- `TOP_LANDMARKS` (13 points, `types.ts:148`) are the only landmark set. `validateImage` rejects any non-top
  (`validate.ts:136`).
- `REQUIRED` is per category (`validate.ts:20`): top `chest + length`, bottom `waist + inseam`.
- The generic parts carry over unchanged: `MeasuredValue` and its origin, `MeasurementProvenance`, `SourceTier`, `GarmentAudit`,
  `ConfidenceGrade`, `sizing`, `fitIntent`.

### 1.2 `app/src/domain/fit/rules.ts` (and `fitEngine.ts`)

- `GirthRule` (`rules.ts:21`) is `tightBelow / fittedMax / relaxedMax / ideal` in cm. That's generic in shape,
  but every band is in absolute cm. A leggings rule needs bands as a **fraction of the body**, centred **below zero**.
- Negative ease today only comes in through `STRETCH_ALLOWANCE` (`rules.ts:112`), which lowers the "tight" boundary
  by a fraction of the body (`fitEngine.ts:183`). It can't say "the right fit is −8 %".
- `TOP_CHEST`, `WOMENS_TOP_CHEST` and `TOP_GIRTH_RULES` (`rules.ts:40–78`) are tops by sizing. `BOTTOM_WAIST`,
  `BOTTOM_HIPS` and `INSEAM` (`rules.ts:81–105`) are one set for everyone. There are no rules for rise, thigh or
  leg opening.
- **Personal fit is tee-only.** `INTENT_EASE` (`rules.ts:133`) is "target chest ease for a tee", and the anchor
  constants (`rules.ts:141–147`) are tee chest and tee length.
- `fitEngine.zonesFor` (`fitEngine.ts:117–138`) is a hard-coded `if (category === 'top')`, and
  `ZoneId` (`fitEngine.ts:23`) is a closed union. `unknownReason` (`fitEngine.ts:140`) has tee checks written in
  (length must be `hps`, sleeve must be `shoulder_to_cuff`).
- `overallTone` (`fitEngine.ts:232`) and `labelGirth`/`labelLength`/`bandsFor` are already generic. So is the
  rule "a girth we couldn't check means unknown", which is exactly what new categories need.

### 1.3 `recommendSize` — `app/src/domain/fit/sampleFit.ts`, `preference.ts`

- `pickSize` (`sampleFit.ts:265`) is generic: highest chance of liking it, ties go roomier, null when unscored
  or no girth was scored. **Keep as is.**
- What feeds it is tee-shaped:
  - `GIRTH_KEYS`, `GARMENT_KEYS` and `BODY_KEYS` (`sampleFit.ts:82–92`) are hand-written lists. A new
    measurement such as thigh wouldn't be sampled at all.
  - `idealEaseCm` (`sampleFit.ts:138`) switches on top/bottom.
  - The miss on tops uses the personal chest target (`sampleFit.ts:220`).
  - `measurableFor` (`sampleFit.ts:290`) switches on top/bottom.
- `personalFit` (`preference.ts:262–281`) only personalises a top's chest and length. Every other zone falls back
  to its objective label. `combine` (`preference.ts:284`) is close to generic, but "much roomier" is chest-only.
- The anchor is a tee by definition (`preference.ts:24–35`, `anchorCandidates` at `:84`).

### 1.4 Mannequin rendering — `app/src/ui/components/Mannequin/`

- `Mannequin.tsx:17–24` takes exactly `top?` and `bottom?`. The stored outfit is the same two slots
  (`ui/state/stored.ts:33–38`, `EMPTY_OUTFIT` at `:125`). There is no layer order, no third slot and no one-piece.
- `topShape.ts` is tee physics through and through: `SHORT_SLEEVE_CM`, `DROP_*`, `HANG`, `MAX_SIDE_ROOM_CM` and
  `MAX_SIDE_FLARE_CM` (`topShape.ts:40–64`). It takes `bodyChestCm`, and when the chart can't be trusted it
  draws `bodyChestCm * 1.08` (`topShape.ts:116`).
- `bottomShape` (`geometry.ts:355`) draws from waist, hips and inseam, but:
  - the waistband sits at a fixed `lerp(waist, hip, 0.25)` (`geometry.ts:358`). **The chart's rise is ignored.**
  - the leg opening comes from `HEM_HALF` by garment type (`geometry.ts:344`), **not from the chart**.
  - the knee width is half the hip plus the hem (`geometry.ts:373`), which is invented.
- `bodyGeometry` (`geometry.ts:137`) **breaks the skin rule** for anything below the waist:
  - hip at `0.49 H` and knee at `0.72 H` (`geometry.ts:153–154`), and the waist at `0.385 H` (`geometry.ts:162`)
  - thigh width as half the hip width (`geometry.ts:178–179`)
  - all widths through ellipse factors (`halfWidth`, `geometry.ts:69`)

  That's harmless while no zone scores thigh, knee height or rise. It becomes wrong the moment one does: the
  readout would say "thigh +4 cm" and the drawing would show something else.
- `BodyGeometry.leg` and `arm` are `Limb`-like (top, bottom, half-widths). That's reusable for sleeves, trouser
  legs and leggings alike.

### 1.5 Photo warp — `app/src/ui/components/Mannequin/photoWarp.ts`

- Generic, keep: `triangleAffine`, `applyAffine` and `affineToSvg` (`photoWarp.ts:57–78`), `regionClips` (`:208`),
  `foldedPieces` (`:289`), and the strip idea for limbs (`SLEEVE_STRIPS`, `sleeveTriangles`, `:92–144`).
- Tee-specific: `Corner` names (`:84`), `BODY_RIGHT` fan from the centre line (`:115`),
  `WarpRegion = 'body' | 'sleeveLeft' | 'sleeveRight'` (`:31`), `warpPieces(photo, shape, sleeves)` signature (`:253`),
  and `TOP_LANDMARKS` in the domain.
- Data side: `GarmentImage.landmarks: Record<TopLandmarkName, …>` (`types.ts:184`), `validateImage`
  (`validate.ts:127`), and the `/dev/landmarks` picker (`app/src/dev/landmarks/suggest.ts`), which suggests
  landmarks from a tee outline.

### 1.6 `data:check` — `app/src/domain/garments/verify.ts`, `verifyRules.ts`

- `GIRTH_METHOD_LIMITS` covers chest, waist and hips only (`verifyRules.ts:20`). `TOP_RANGES`,
  `TOP_LENGTH_RANGES` and `BOTTOM_RANGES` (`:27–49`) are keyed by top/bottom.
- `REFERENCE_CHEST_IN` (`:58`) and `CHEST_EASE_BY_INTENT` (`:82`) are the men's/unisex tee chest. `BOTTOM_WAIST_EASE`
  (`:93`) works for pants sized by waist.
- Generic, keep: monotonic order, grading (`GRADING_RATIO`), audit tolerance, and "unscorable when a required
  definition is unknown" (`unscorableZones`, `verify.ts:262`).

---

## 2. Generic category design

### 2.1 Shape of it

A new category is mostly **data in four places**. It doesn't need new branches in the engine:

```
domain/garments/categories/<id>.ts   CategorySpec   measurements, definitions, data:check rules, landmarks
domain/fit/zones/<id>.ts             ZoneSpec[]     which zones, body target, rule per zone, personal zone
domain/fit/rules.ts                  rule tables    per-zone ease bands (cm or fraction), stretch, intent targets
ui/components/Mannequin/templates/<id>.ts  DrawTemplate  outline + warp mesh, from domain numbers only
```

A registry maps each `GarmentType` to one **template** (`TemplateId`). A template says which slot it fills.
`category` stays in the seed, as the slot, so rows still read well; `validate` checks that it matches the type's
template.

```ts
// domain/garments/types.ts
export type TemplateId =
  | 'tee' | 'shirt' | 'knit'            // tops
  | 'pants' | 'shorts' | 'leggings'     // legwear
  | 'skirt' | 'dress'
  | 'jacket'                            // jackets and coats
  | 'bra';

/** Where a garment is worn. Drawing order and outfit slots follow this. */
export type Slot = 'underwear' | 'legwear' | 'bottom' | 'onepiece' | 'top' | 'mid' | 'outer';
export type GarmentCategory = Slot;     // widened; 'top' and 'bottom' keep their meaning

export type GarmentType =
  | 'tee' | 'long-sleeve-tee' | 'polo' | 'button-up'
  | 'hoodie' | 'sweatshirt' | 'sweater' | 'cardigan'
  | 'jeans' | 'chinos' | 'joggers' | 'trousers'
  | 'shorts' | 'skirt'
  | 'jacket' | 'blazer' | 'coat' | 'puffer'
  | 'dress'
  | 'leggings'
  | 'bra';

export const TYPE_TEMPLATE: Record<GarmentType, TemplateId> = {
  tee: 'tee', 'long-sleeve-tee': 'tee', polo: 'tee', 'button-up': 'shirt',
  hoodie: 'knit', sweatshirt: 'knit', sweater: 'knit', cardigan: 'knit',
  jeans: 'pants', chinos: 'pants', joggers: 'pants', trousers: 'pants',
  shorts: 'shorts', skirt: 'skirt',
  jacket: 'jacket', blazer: 'jacket', coat: 'jacket', puffer: 'jacket',
  dress: 'dress', leggings: 'leggings', bra: 'bra',
};
```

### 2.2 Measurements and definitions

```ts
/** Everything a chart can give, any category. Include only what the chart lists. */
export interface SizeMeasurements {
  // girths (full circumference after normalising)
  chest?: number; underbust?: number; waist?: number; hips?: number;
  thigh?: number; knee?: number; legOpening?: number; hemSweep?: number;
  bicep?: number; cuff?: number; hemBand?: number;
  // stretched girths, when a chart prints "relaxed / extended" (waistbands, rib hems)
  waistStretched?: number; hemBandStretched?: number;
  // lengths
  length?: number; sleeve?: number; shoulder?: number;
  inseam?: number; rise?: number; backRise?: number; outseam?: number;
}
export type MeasurementKey = keyof SizeMeasurements;

/** Where a measurement is taken. Unknown is allowed, and a zone that needs it is then unscored. */
export interface Definitions {
  length?: 'hps' | 'center_back' | 'waist' | 'unknown';          // tops, dresses (hps/cb), skirts (waist)
  sleeve?: 'shoulder_to_cuff' | 'center_back_to_cuff' | 'top_of_sleeve' | 'unknown';
  rise?: 'front' | 'back' | 'total' | 'unknown';                 // front = waistband top to crotch seam
  thigh?: 'at_crotch' | 'below_crotch_2_5cm' | 'unknown';
  hips?: 'fullest' | 'below_waist_cm' | 'unknown';               // skirts often: a fixed cm below the waist
  hipsBelowWaistCm?: number;
  waistSeam?: 'natural' | 'empire' | 'drop' | 'none';            // dresses
}

export interface SeedGarment extends GarmentBase {
  chart: {
    unit: 'cm' | 'in';
    /** One method for the whole chart, or per measurement (pants: waist full, thigh flat). */
    girth: GirthMethod | Partial<Record<MeasurementKey, GirthMethod>>;
    definitions?: Definitions;          // replaces lengthDefinition / sleeveDefinition (migrated in normalize)
  };
  /** Garment default, plus per-zone overrides (a jogger: { waist: 'high' }, the rest 'none'). */
  stretch: Stretch | { default: Stretch } & Partial<Record<MeasurementKey, Stretch>>;
  /** Fabric bulk, for layering (§3). Default by template. */
  weight?: 'light' | 'mid' | 'heavy';
  sizes: SeedSize[];
}
```

`normalizeGarment` already records each conversion in its provenance. It gains a per-key girth method and maps the
old `lengthDefinition`/`sleeveDefinition` fields into `definitions`. The old names stay readable in the seed, so
`seed.json` doesn't need a rewrite.

### 2.3 Zones and per-zone ease (negative ease, stretch)

```ts
// domain/fit/zones.ts
export type ZoneId =
  | 'chest' | 'underbust' | 'waist' | 'hips' | 'thigh' | 'knee' | 'calf' | 'legOpening' | 'hemBand'
  | 'shoulder' | 'bicep'
  | 'length' | 'sleeve' | 'inseam' | 'rise'
  | 'band' | 'cup';

/** girth: ease = garment − body · length: garment − target · landing: where it ends (descriptive). */
export type ZoneKind = 'girth' | 'length' | 'landing';

export interface ZoneSpec {
  zone: ZoneId;
  kind: ZoneKind;
  garmentKey: MeasurementKey;
  /** The body number to compare with. A function when the target is derived (girth at the waistband's height). */
  body: BodyKey | ((b: BodyMeasurements, g: Garment, s: SizeMeasurements) => number);
  rule: RuleRef;                      // looked up in rules.ts by template + zone (+ sizing)
  /** A required zone that can't be scored makes the size "unknown" (today's girth rule, made explicit). */
  required: boolean;
  /** When this zone applies at all. Long sleeves only, chart lists it, etc. */
  applies?: (g: Garment, s: SizeMeasurements) => boolean;
  /** The definition this zone needs, and which values it accepts. */
  needs?: { definition: keyof Definitions; accepts: readonly string[] };
}

export interface TemplateZones {
  template: TemplateId;
  zones: ZoneSpec[];
  /** The girth that carries the personal preference (tee: chest). null = objective only (pants for now). */
  personalZone: ZoneId | null;
  /** Body measurements the user can type in that change this template's result (measurementHint). */
  measurable: BodyKey[];
}
```

`fitEngine.zonesFor` becomes `TEMPLATE_ZONES[TYPE_TEMPLATE[g.type]].zones.filter(z => z.applies?.(g, s) ?? true)`.
`unknownReason` reads `needs` instead of naming length and sleeve. `sampleFit`'s key lists come from the zones of
the garment's template. `measurableFor` becomes `measurable`.

**Rules.** One rule type covers today's bands, negative ease and stretch:

```ts
// domain/fit/rules.ts
export interface EaseRule {
  kind: 'girth';
  /** 'cm' as today; 'fraction' = a share of the body measurement (−0.08 = 8 % smaller than the body). */
  scale: 'cm' | 'fraction';
  tightBelow: number;   // may be negative: leggings −0.18
  fittedMax: number;    // may be negative: leggings −0.02
  relaxedMax: number;
  ideal: number;        // may be negative: leggings −0.08
  /** How much stretch moves "tight" down, per Stretch level. Defaults to STRETCH_ALLOWANCE. */
  stretch?: Partial<Record<Stretch, number>>;
}
export interface LengthRule { kind: 'length'; shortBelow: number; longAbove: number; ideal: number }
/** Descriptive only: never makes a size good or bad, so overallTone and pickSize skip it. */
export interface LandingRule { kind: 'landing'; marks: { label: string; atCm: number }[] }

export type Stretch = 'none' | 'some' | 'high' | 'compression';
export const STRETCH_ALLOWANCE: Record<Stretch, number> = { none: 0, some: 0.04, high: 0.2, compression: 0.35 };

/** Every rule, by template and zone; a zone may vary by garment sizing (as TOP_GIRTH_RULES does today). */
export const RULES: { [T in TemplateId]?: Partial<Record<ZoneId, Rule | Record<GarmentSizing, Rule>>> };
```

How labelling works:
- `labelGirth` works on `ease = garment − body` (cm scale) or on `ease / body` (fraction scale).
- Stretch lowers `tightBelow` by `allowance × body`, as today, but the allowance is per zone.
- When a chart prints a stretched value (`waistStretched`), it **replaces** the heuristic: tight means
  `waistStretched < body`. The provenance shows which one was used.
- Labels stay `tight / fitted / relaxed / loose`. `fitText.ts` picks the wording per template, so on leggings
  "loose" reads "baggy" and "tight" reads "too much squeeze".

**Personal fit.** `INTENT_EASE` becomes `INTENT_EASE[template][intent]` for the template's `personalZone`. Tee
numbers stay as approved. Pants, skirts and bras stay objective until there's a "pants you like" anchor; that's
not in this plan. `combine` reads `personalZone` instead of `'chest'`.

**Landing zones** are new and matter for shorts, skirts, dresses and coats. A hem isn't right or wrong, it lands
somewhere: "ends 6 cm above your knee", "mid-thigh", "covers the hip". They show in the readout, but `overallTone`
and `pickSize` ignore them, the same way `recommendSize` already never picks on length alone. The body landmarks
they need (knee height, hip line, navel height) come from the body model (§5), never from the drawing.

### 2.4 Drawing / warp template (ui)

```ts
// ui/components/Mannequin/templates/types.ts
export interface Envelope {            // what the garment drapes over: the body, or the layer under it (§3)
  halfAt(y: number): number;           // right-side half-width at height y
  arm: Limb; leg: Limb;
}
export interface DrawInput {
  g: BodyGeometry;                     // from BodyMeasurements only
  body: BodyMeasurements;
  garment: Garment;
  size: GarmentSize;
  under: Envelope;                     // body envelope, or the one from the layer below
  layerBulkCm: number;                 // from domain/fit/layers.ts — the same number the fit used
}
export interface DrawnGarment {
  regions: { id: string; d: string }[];          // 'body', 'sleeveLeft', 'legRight', 'cupLeft'…
  overlays: { arms?: [string, string]; folds: string[]; strain: string[] };
  markers: Partial<Record<ZoneId, Marker>>;
  landmarks: Record<string, Pt>;                  // the template's landmark names, drawn position
  limbEdges: Record<string, SleeveEdges>;         // sleeves and legs, for strip warps
  envelope: Envelope;                             // for the next layer up
  approximate: boolean;
}
export interface DrawTemplate {
  id: TemplateId;
  draw(input: DrawInput): DrawnGarment;
  mesh: WarpMesh;                                 // triangles over landmark names + limb strips
}
export interface WarpMesh {
  regions: { id: string; triangles: [string, string, string][]; strips?: { limb: string; count: number } }[];
}
```

- `topShape` becomes the `tee` template unchanged. `shirt` and `knit` reuse it with different constants
  (a sweater's `HANG` is lower; a rib hem gathers in).
- `bottomShape` becomes the `pants` template and reads rise, thigh, knee and leg opening from the chart.
  `HEM_HALF` stays only as the fallback when the chart lacks a leg opening, and that sets `approximate` (dashed),
  exactly like a top with an unverified girth.
- Landmark **names** live in the domain (`categories/<id>.ts`), because the seed stores them and `validateImage`
  checks them. Triangles live in the ui template. `warpPieces(photoLm, drawn, mesh)` loops over `mesh.regions`;
  the tee mesh is today's `BODY_RIGHT` and the sleeve strips. Pants reuse the sleeve strip code for each leg
  (`legOuterLeft`/`legInnerLeft` edges are the same idea as a sleeve's outer and inner edges).

Pants landmarks, proposed: `waistLeft, waistRight, waistMid, hipLeft, hipRight, crotch, kneeOuterLeft,
kneeInnerLeft, kneeOuterRight, kneeInnerRight, hemOuterLeft, hemInnerLeft, hemOuterRight, hemInnerRight`
(14 points; the knee points are optional and the strips interpolate without them).

**Skin-rule fixes in the drawing (PR 1):**
- `bodyGeometry`'s waist, hip, knee and crotch heights come from new body measurements (`waistHeightCm`,
  `hipHeightCm`, `kneeHeightCm`, plus `inseamCm`, which is already there).
- Thigh and knee widths come from `thighCm` and `kneeCm`, through `halfWidth`.
- The pants waistband sits where the **engine** says it sits (§2.6), not at `lerp(..., 0.25)`.
- `halfWidth` ellipse factors can stay as skin: they turn an engine circumference into a front width and don't
  decide fit. (ANSUR II women's front breadths give C/3.5 at the chest, C/2.9 at the waist, C/2.9 at the hips;
  today's factors are C/2.7, C/2.8 and C/2.75. A later "true widths" change could take them from the survey.)

### 2.5 `data:check` rules per category

```ts
// domain/garments/categories/types.ts
export interface CategoryChecks {
  /** Without these the garment says nothing useful (today's REQUIRED). */
  required: MeasurementKey[];
  /** Definitions a required zone needs; unknown → grade "unscored" (today's lengthDefinition rule). */
  requiredDefinitions: (keyof Definitions)[];
  /** Plausible values, cm, full circumference. Warnings. */
  ranges: Partial<Record<MeasurementKey, Range>>;
  /** Printed flat above flatMax / full below circumferenceMin → error (today's GIRTH_METHOD_LIMITS, per key). */
  girthMethod: Partial<Record<MeasurementKey, { flatMax: number; circumferenceMin: number }>>;
  /** Within one size: thigh < hips / 2 + 8, legOpening ≤ knee ≤ thigh, waist ≤ hips … Warnings. */
  relations: { message: string; holds: (m: SizeMeasurements) => boolean }[];
  /** Ease against a typical body for the size label (today's chest table and BOTTOM_WAIST_EASE). */
  labelEase?: (label: string, m: SizeMeasurements, g: SeedGarment) => string | null;
  /** Grading runs: which keys must grow size to size, and how sizes group (pants: one run per inseam). */
  monotonic: MeasurementKey[];
}
export interface CategorySpec {
  template: TemplateId;
  slot: Slot;
  landmarks: readonly string[];
  checks: CategoryChecks;
}
```

`checkGarment` loops over `spec.checks` instead of switching on top and bottom. Errors and warnings keep their
meaning, so the grade and the report don't change.

### 2.6 What this means for pants (PR 1)

| Zone | Kind | Garment | Body target | Starting rule (assumed, tune with Test mode) |
|---|---|---|---|---|
| waist | girth | `waist` (or `waistStretched`) | body girth **at the waistband's height**, between `waistCm` and `hipsCm` | `BOTTOM_WAIST` as today |
| hips | girth | `hips` | `hipsCm` | `BOTTOM_HIPS` as today |
| thigh | girth | `thigh` (needs `definitions.thigh`) | `thighCm` | tight < −1 cm − stretch; fitted ≤ 5; relaxed ≤ 10; ideal 3 |
| rise | landing + check | `rise` (front) | `frontRiseCm`, navel height | marks: low / mid / high rise; warn if the band lands below the hip line |
| inseam | length | `inseam` | `inseamCm` | `INSEAM` as today |
| legOpening | landing + check | `legOpening` | `calfCm`, `heelAnkleCm` | marks: skinny / slim / straight / wide; **bad** when it won't pass the heel (no stretch, no zip) |

Where the band sits: `bandHeight = crotchHeight + 0.71 × frontRise`. In ANSUR II women, navel height − crotch
height is 19.8 cm vertical, against a front crotch length of 27.9 cm along the body, so 0.71 is that ratio. Men's
needs the same check on the male file. This one function is what lets the rise change the waist result: a
low-rise jean's "waist" gets compared to the body where it actually sits. The drawing reads the same function,
so pin and picture agree.

---

## 3. Layering: a jacket over a top

### 3.1 Fit

Size charts and the ease bands are **bare-body** numbers. Brands grade a jacket assuming something light
underneath. So the outer template states what it assumes, and we only add the bulk *beyond* that:

```ts
// domain/fit/layers.ts
export const LAYER_BULK_CM: Record<'light' | 'mid' | 'heavy', number> = {   // circumference added, assumed
  light: 0.5,    // tee, shirt        (2π × ~0.8 mm)
  mid: 2,        // sweatshirt, knit  (2π × ~3 mm)
  heavy: 3.5,    // heavy hoodie, fleece
};
/** Share of an under-layer's spare ease (beyond fitted) that still takes room once compressed. Assumed. */
export const UNDER_EASE_KEPT = 0.25;

export interface WornLayer { garment: Garment; sizeLabel: string; slot: Slot }

/** The body an outer layer sees, zone by zone: the body plus the layers under it, minus what the template assumes. */
export function effectiveBody(body: BodyModel, under: WornLayer[], outer: Garment): BodyModel;

export interface OutfitFit {
  layers: { garmentId: string; fit: GarmentFit }[];
  /** "The hoodie shows below the jacket", "The sweater bunches under the sleeves". Never changes a label. */
  notes: LayerNote[];
}
export function fitOutfit(body: BodyModel, worn: WornLayer[]): OutfitFit;
```

- `jacket` assumes a `light` layer underneath. A hoodie under it adds `heavy − light = 3 cm` to the chest,
  plus `UNDER_EASE_KEPT ×` the hoodie's ease beyond fitted. The chest and bicep zones use that effective body.
  Lengths and the shoulder use the bare body.
- **Size cards stay bare-body.** `recommendSize` for a jacket on its own uses the template's assumption. Only the
  fitting room, with an actual layer under it, uses `fitOutfit`, and the readout says "with your hoodie under it".
- `sampleFit` keeps one body draw per sample, shared by every layer. That way an estimated chest moves the hoodie
  and the jacket together, just as an anchor tee shares it today.
- Layer notes are checks, not labels:
  - under-layer hem lands below the outer hem (landing zones of both)
  - under-layer sleeve longer than the outer sleeve
  - under-layer chest ease above the outer's effective ease ("bunches")

### 3.2 Drawing

- The Mannequin takes `worn: WornGarment[]` and sorts by slot: `underwear → legwear → bottom → onepiece →
  top → mid → outer`. Tops draw over bottoms, untucked, as today.
- Each template's `draw` gets `under: Envelope`: the body for the first layer, then the previous layer's
  `envelope`, grown by `layerBulkCm / 2π` per side. `topShape` already uses `bodyHalfAt` and `g.half.chest`;
  those become `under.halfAt` and the envelope's half at chest height. The jacket then hangs off the hoodie,
  not the body.
- `layerBulkCm` comes from `domain/fit/layers.ts`, the same number `effectiveBody` used. That keeps the skin rule.
- Arms: today the arm is drawn again over the shirt below a short sleeve (`TopShape.arms`). With an outer layer,
  each layer's sleeve is clipped by the sleeve above it, and only the outermost layer draws the arm overlay.
- An under-layer hem that lands lower than the outer hem stays visible below it, because it was drawn first.
  Nothing extra is needed.
- An open jacket (`closure: 'open'`, a drawing option) draws two front panels, with the layer under it visible
  between them. Closed comes first; open can wait.
- Storage: `outfit` → `choudo.outfit.v2` = `{ [slot]: { id, size } | null }`. `migrate.ts` maps v1's
  `topId/topSize/bottomId/bottomSize` to `top` and `bottom`. Saved outfits (`outfits`) migrate the same way.
  A dress fills `onepiece` and clears `top` and `bottom`; putting a top on clears `onepiece`.

---

## 4. Bras: beside the zone engine, sharing its parts

### 4.1 Why not plain zones

A bra size is two numbers about the **body**: the band is the underbust, and the cup is bust minus underbust.
Brands publish body ranges per size, almost never garment measurements. So a bra chart is source tier **F
(body-size chart only)**, and its grade stays **estimated**: the grading order already does this
(`grade.ts`, `WEAK_TIERS`). The design keeps one exception open: if a brand spec gives the band's relaxed length
and its stretch (tier A), the band becomes an ordinary negative-ease girth zone (fraction scale, ideal around −10 %).
No new mechanism is needed.

So bras get their own small module that returns the **same `GarmentFit`/`ZoneFit` shape**. The readout, sampler,
`pickSize`, verdicts and grade all work unchanged:

```ts
// domain/fit/bra.ts
export type BraSystem = 'us' | 'uk' | 'eu' | 'fr' | 'au';

/** A bra size as numbers: band index and cup index, plus the system it was printed in. */
export interface BraSizeIndex { system: BraSystem; band: number; cup: number }   // cup: AA = 0, A = 1 …

/** A bra size row from a body-size chart: what body each size is for. Seed values stay "estimated". */
export interface BraChartSize {
  label: string;                        // "34D", "75D"
  underbustCm: Range;                   // from the chart, or from the system's convention (origin "estimated")
  bustCm: Range;
}

/** Zones: band (underbust vs. the size's range) and cup (bust − underbust vs. the size's cup range). */
export function fitBra(body: BodyModel, garment: Garment & { bra: { system: BraSystem; sizes: BraChartSize[] } }, sizeLabel: string): GarmentFit;

export function convertBraSize(size: BraSizeIndex, to: BraSystem): BraSizeIndex;
export function sisterSizes(size: BraSizeIndex): { down: BraSizeIndex; up: BraSizeIndex };
```

- **band**: `ZoneFit` kind girth, bands relative to the size's underbust range. Below the range reads "tight
  band"; above reads "band rides up" (in a bra, loose is the common failure).
- **cup**: bust − underbust against the cup's range. Under reads "cups too small"; over reads "cups gap".
- The **personal anchor** for bras is the bra the user wears now plus one answer: fits / band rides up / band
  digs in / cups gap / cups spill. That's the same idea as the anchor tee. The answer moves one step along band or
  cup, and sister sizes (below) give the alternatives.
- `body.bra` already exists (`BodyModel.bra`, `braSize.ts`). It estimates the bust as band + cup inches. For a
  bra fit, the bra size alone **cannot** give the underbust: a "34" band is a 34 in underbust under the modern
  (+0) convention, but about 30 in under the traditional "+4" one. So underbust must be measured, or set from
  the user's current bra plus the brand convention, with its spread widened (§5).

### 4.2 Conversion and sister sizes

Bands. US and UK bands are inches; EU uses underbust cm in 5 cm steps; FR/ES/BE add 15 to EU; AU/NZ subtract 22
from UK.

| US / UK | 28 | 30 | 32 | 34 | 36 | 38 | 40 | 42 | 44 |
|---|---|---|---|---|---|---|---|---|---|
| EU | 60 | 65 | 70 | 75 | 80 | 85 | 90 | 95 | 100 |
| FR / ES | 75 | 80 | 85 | 90 | 95 | 100 | 105 | 110 | 115 |
| AU / NZ | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 | 22 |

Cups by index. This is how brands' international tables convert. The UK and US columns are already in
`braSize.ts` `CUP_INCHES`; EU, FR and AU are new:

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| US | AA | A | B | C | D | DD (E) | DDD (F) | G | H | I | J | K | L |
| UK, AU | AA | A | B | C | D | DD | E | F | FF | G | GG | H | HH |
| EU, FR | AA | A | B | C | D | E | F | G | H | I | J | K | L |

- US and UK cups step 1 in (2.54 cm); EU cups step 2 cm (EN 13402: A is about 12–14 cm bust − underbust). So
  the index match drifts by about 0.5 cm per step. By index 8 (UK FF / EU H) the true cup difference is about
  4 cm apart. `convertBraSize` converts by index, as retailers do, and the converted size gets a wider spread
  (`BRA_CONVERT_SD_CM_PER_STEP`, new in `uncertainty.ts`). Always prefer the brand's own chart in its own system.
- **Sister sizes** keep the cup volume and move the band: one band down, one cup up, and the reverse.
  US/UK 34C ↔ 32D ↔ 36B; EU 75C ↔ 70D ↔ 80B. `sisterSizes` is band ± 1 step and cup ∓ 1 index. It's only
  offered when the cup answer is "fits" and the band answer isn't.
- Check these tables against a real brand chart (Panache/Freya publish international tables) when seeding.
  They're common retailer tables, not a standard.

### 4.3 Drawing

Two cups and a band over the bust region. The cups are drawn from `chestCm`, `underbustCm` and the bust
height (`chestHeight`, §5). Without a bra photo mesh, it's a flat colour. Bras get no photo warp in their PR,
and `validateImage` keeps rejecting them.

---

## 5. Women's body data: what's needed, and does ANSUR II cover it?

I checked against the ANSUR II female public CSV (1,986 women; the copy the women's-sizing session downloaded,
still in its scratchpad). These are ordinary least squares on height and weight, the same method as
`WOMENS_REGRESSION`. Columns are ANSUR's names.

| Needed for | Measurement | ANSUR II column | R² | residual SD | Verdict |
|---|---|---|---|---|---|
| bras, empire-waist dresses | **underbust** | — (not in the public file) | — | — | **Not covered.** Tape (new optional override), or from the current bra + brand convention with a wide spread. Never from height and weight alone. |
| pants, shorts, leggings | thigh | `thighcircumference` | 0.83 | 2.3 cm | Good |
| skinny jeans, leggings | knee (just above) | `lowerthighcircumference` | 0.71 | 1.9 cm | Good |
| leggings, leg opening | calf | `calfcircumference` | 0.65 | 1.7 cm | Usable |
| leg opening must pass the foot | heel–ankle | `heelanklecircumference` | 0.59 | 1.0 cm | Usable (small SD) |
| leggings hem | ankle | `anklecircumference` | 0.37 | 1.2 cm | Weak R², small SD: usable with its spread |
| pants rise | front crotch length | `crotchlengthomphalion − crotchlengthposterioromphalion` | 0.30 | 2.5 cm | **Weak**: needs its own wide spread, and the "rise" line in the body form |
| pants rise (total) | crotch length | `crotchlengthomphalion` | 0.39 | 3.3 cm | Weak |
| waistband height, landing | navel (waist) height | `waistheightomphalion` | 0.84 | 2.0 cm | Good |
| inseam (have it) | crotch height | `crotchheight` | 0.73 | 2.3 cm | Good (already used) |
| hip line, hem landing | hip height | `trochanterionheight` / `buttockheight` | 0.74 / 0.71 | 2.3 / 2.5 cm | Good |
| skirts, dresses, shorts landing | knee height | `kneeheightmidpatella` | 0.71 | 1.4 cm | Good |
| CB lengths (Uniqlo-style charts) | back neck height | `cervicaleheight` | 0.97 | 1.1 cm | Very good: makes `center_back` length scoreable |
| tops, jackets | shoulder height | `acromialheight` | 0.95 | 1.3 cm | Very good (replaces `torsoLength = 0.41 H`) |
| knits, raglan sleeves | **CB-to-wrist sleeve** | `sleevelengthspinewrist` | 0.70 | 2.1 cm | Good: makes `center_back_to_cuff` scoreable |
| long sleeves | shoulder to wrist | `sleeveoutseam` | 0.63 | 1.8 cm | Usable (replaces `0.35 H`) |
| jackets | shoulder width | `biacromialbreadth` | 0.35 | 1.5 cm | Weak R², small SD: usable with its spread |
| jacket and knit sleeves | bicep | `bicepscircumferenceflexed` | 0.79 | 1.4 cm | Good, but **flexed**: reads high for a relaxed arm; take about 1 cm off (assumption) |
| dress bodice, bra drawing | bust height | `chestheight` | 0.84 | 2.2 cm | Good |
| hoodies, collared shirts | neck base | `neckcircumferencebase` | 0.53 | 1.3 cm | Usable |
| one-pieces (later) | vertical trunk | `verticaltrunkcircumferenceusa` | 0.75 | 3.8 cm | Good, out of scope |

Notes:
- ANSUR II's waist is at the navel. That's where a mid-rise band sits. A "natural waist" (narrowest), which
  dresses and high-rise skirts use, isn't in the file. Treat it as navel waist with its own spread, or let the
  user enter it.
- `crotchheight / stature` averages **0.480** for women, the same number the women's-sizing hand-over found. The
  men's `inseam: 0.45` ratio is probably low. PR 1 should fit men's on the **ANSUR II male** file: download it to
  the scratchpad only, the same way, and use the same columns. The men's power law has no thigh, rise or heights.
- Every new estimated key gets an entry in `ESTIMATED_BODY_SD_CM[bodyType]` (`uncertainty.ts:33`) from its
  residual SD, and `measurementHint` can name it ("measure your thigh").
- New overrides worth a field on the body screen: underbust (bras, PR 6), thigh (pants, PR 1, optional), and
  natural waist (dresses, optional). Every one is optional, as today.
- Remember ANSUR II is a military population: fitter, younger, BMI 16–41. Keep the clamps in `INPUT_LIMITS`.

---

## 6. PR plan

Each PR passes `npm run check`, adds seed rows by hand per `docs/adding-garments.md` (no scraping; the Uniqlo
terms note still applies), extends Test mode so its assumed thresholds can be tuned, and updates CLAUDE.md.

| # | PR | Size | What's in it |
|---|---|---|---|
| 1 | **Generic categories + pants** | **L** | Template/zone/category registry; per-key girth method and stretch; `EaseRule` (cm or fraction); landing zones; pants zones waist (at band height), hips, rise, thigh, inseam, leg opening; new body keys; drawing and warp for pants |
| 2 | Hoodies / sweaters | M | `knit` template on the tee drawing; CB sleeve and CB length now scoreable; rib hem/cuff stretch; `weight` field |
| 3 | Skirts / shorts | M | `shorts` (pants template, inseam as landing); `skirt` template (waist, hips at a defined drop, hem landing, walking room) |
| 4 | Jackets / coats | L | `jacket` template (chest, shoulder, sleeve, bicep, length landing); layering engine; outfit v2 slots + migration; layer stack in the Mannequin |
| 5 | Dresses | L | `onepiece` slot; bust, waist (by seam), hips, length landing; joined top + skirt drawing and mesh |
| 6 | Bras (on hold) | M | `bra.ts` beside the zone engine; underbust input; EU/FR/AU + sister sizes; current-bra anchor; simple drawing |
| 7 | Leggings | S | `leggings` template: fraction-scale negative ease, `compression` stretch, skin-tight drawing on the pants mesh |

### PR 1 — generic design + pants (Large)

Commit order:
1. **Registry with no behaviour change.** `TYPE_TEMPLATE`, `CategorySpec`, `TemplateZones` for `tee`, `shirt`
   and `pants`, reproducing today's `zonesFor`. `sampleFit` key lists and `measurableFor` read from the
   template. Before touching anything, add a golden test: `fitAllSizes` + `sampleFit` for every seed garment on
   a few bodies, byte-equal before and after.
2. **Rules.** `EaseRule` with `scale`; `STRETCH_ALLOWANCE` per zone; `chart.girth` per key; `definitions`
   (old `lengthDefinition`/`sleeveDefinition` still read). Landing zones (`kind: 'landing'`) skipped by
   `overallTone`/`pickSize`.
3. **Body.** `thighCm`, `kneeCm`, `calfCm`, `heelAnkleCm`, `frontRiseCm`, `waistHeightCm`, `hipHeightCm`,
   `kneeHeightCm` for both body types. Women's from the female file. Men's new keys need an estimate too, but
   the men's ANSUR II re-fit is its own later PR (decision 3): until then men's new keys come from the
   existing men's model (ratios of height, labelled assumed), and nothing men's already has moves. Each key
   gets its spread in `uncertainty.ts`.
4. **Pants zones** (§2.6), including `bandHeight()` and the body girth at the band.
5. **`data:check`.** Pants `CategoryChecks`: thigh and leg-opening girth-method limits, relations
   (`legOpening ≤ knee ≤ thigh`, `thigh < hips / 2 + 8`), rise/thigh definitions required for those zones.
   Grade the existing 6 bottoms: those without a thigh, opening or rise definition stay charted, with those
   zones unknown and not required.
6. **Drawing.** `bodyGeometry` heights and leg widths from the new keys (the skin-rule fix). The `pants` template
   draws the band at `bandHeight()`, with thigh, knee and opening from the chart, and `HEM_HALF` only as a dashed
   fallback.
7. **Photo warp.** Pants landmarks and leg strips; `validateImage` per category; the `/dev/landmarks` picker and
   `suggest.ts` handle a pants outline; `npm run photos` unchanged.
8. **UI wording.** `zoneName` (Thigh, Rise, Leg opening), landing phrases ("sits 2 cm below your navel"); Test
   mode records bottoms (waist / thigh / length answers).

Split into 1a (commits 1–2, Medium, no visible change) and 1b (3–8).

#### PR 1a as built

- **Golden test first**: `domain/fit/golden.test.ts` writes `fitAllSizes`, `personalFit`, `sampleFit` and
  `measurementHint` for every catalogue garment (plus the unknown-chest test tee) on six bodies and four
  preferences, and `normalizeGarment` + `checkGarment` for every seed row, one JSON line per garment under
  `domain/fit/__golden__/`. It stayed byte-identical through both commits, and so did `npm run data:check`.
- **Registry**: `domain/garments/categories.ts` (`TYPE_TEMPLATE`, `CategorySpec` with the data rules) and
  `domain/fit/zones.ts` (`TemplateZones`: zones, rule per zone or per sizing, `needs` for definitions,
  `personal` zones). Templates today: `tee`, `shirt`, `pants`.
- **One change from §2.3**: the sampler draws *every* schema key (`MEASUREMENT_KEYS`,
  `BODY_MEASUREMENT_KEYS`) in a fixed order, not the template's keys. Drawing only the template's keys would
  change the seeded draws for every garment; drawing them all means a new measurement is sampled without
  touching `sampleFit.ts`. New keys go at the end of those lists.
- **Rules**: `GirthRule.scale` (`cm` | `fraction`) rather than a new `EaseRule` type, so today's rules stay as
  written; `girthRuleInCm` turns fraction bounds into cm per body. `GirthRule.stretch` overrides the
  allowance per zone; a garment's `stretch` may be `{ default, <key>: level }`; new level `compression`
  (0.35, assumed). `chart.girth` may be `{ default, <girth>: method }`. `chart.definitions` holds length,
  sleeve, rise, thigh (hips and waist-seam definitions come with skirts and dresses). Landing zones have the
  label `noted` and a `landing` mark.
- Also new: `validateGarment` rejects an unknown type, and a category that isn't the type's template's.

### PR 2 — hoodies / sweaters (Medium)
- `knit` zones: chest (personal, tee `INTENT_EASE` plus a knit offset), length (`hps` or `center_back` against
  `cervicaleHeightCm`), sleeve (`shoulder_to_cuff` or `center_back_to_cuff` against `sleevelengthspinewrist`),
  and `hemBand` (rib: `hemBandStretched` or stretch `high`).
- `weight` field (default `mid`), ready for layering.
- Drawing: the `tee` template with knit constants (stiffer drape, gathered rib hem and cuffs, hood shape for
  hoodies), and the tee mesh plus an optional `hoodTop` landmark.
- Checks: knit ranges, rib relations (`hemBand ≤ chest`).
- Worn in the `top` slot only until PR 4.

### PR 3 — skirts / shorts (Medium)
- `shorts` = the pants template. Its inseam is a landing zone (marks: mid-thigh, above knee, knee), measured from
  the body's crotch height. Waist, hips, thigh and rise are as pants.
- `skirt` template: waist at band height (rise-like `definitions.waist`: natural / mid / low), hips at
  `definitions.hipsBelowWaistCm`, length landing from the waist (mini / above knee / knee / midi / maxi against
  `kneeHeightCm`), and a walking-room check (`hemSweep` against a stride girth from `thighCm` and knee height;
  assumed, warn only).
- Drawing: an A-line from `hemSweep`, or a pencil skirt. The warp mesh is waist, hip and hem corners, with no
  limbs.
- Skirts go in the `bottom` slot.

### PR 4 — jackets / coats (Large)
- `jacket` zones: chest and waist over `effectiveBody`, **shoulder scored** (the seam on the shoulder point,
  ±1.5 cm; assumed), sleeve (both definitions), bicep, and length landing (hip / mid-thigh / knee / calf for
  coats).
- `domain/fit/layers.ts` (§3), `fitOutfit`, and layer notes.
- Outfit `v2` slots + `migrate.ts`, Fitting room "Outer" picker, closet/saved outfits.
- Mannequin `worn[]`, envelopes, and clipping of sleeves and arm overlays. Drawn closed first.
- Photo warp: the tee mesh plus lapel/collar points, optional.

### PR 5 — dresses (Large)
- `onepiece` slot; a dress replaces top + bottom.
- Zones: bust (personal), waist **at the seam** (`definitions.waistSeam`: natural → navel waist with a wider
  spread or the entered natural waist; empire → underbust, unscored until PR 6; none → unscored); hips required
  unless the silhouette is fit-and-flare or A-line (then a landing note); length landing from HPS against knee
  height; shoulder/straps optional.
- Drawing: the tee template's bodice joined to the skirt template at the seam height from the engine. The mesh
  joins both.

### PR 6 — bras (Medium) — on hold until a brand gives garment specs
- `domain/fit/bra.ts` (§4), `BraChartSize` seed shape (tier F → estimated), band/cup zones in `GarmentFit`.
- Underbust override on the body screen; `ESTIMATED_BODY_SD_CM` for an underbust from a bra size, wide.
- `braSize.ts` gains EU/FR/AU, `convertBraSize` and `sisterSizes`. Tests cover the tables in §4.2 as fixtures.
- Current-bra anchor with the five answers. Simple cup drawing; no photo warp.
- Slot `underwear`, drawn under every other layer.

### PR 7 — leggings (Small)
- `leggings` = pants zones with `EaseRule` fraction scale: waist, hips, thigh, knee and calf, with ideal around
  −8 % and tight below about −18 %. All assumed; tune with fit tests.
- `compression` stretch. Inseam is a length zone (full) or a landing zone (7/8, capri).
- Drawing follows `under` (the body) plus 0.2 cm, with no folds. Reuses the pants mesh.
- Slot `legwear`, so shorts or a skirt can go over them.

---

## Decisions (2026-11-20)

1. New thresholds ship labelled **"assumed"**, as `WOMENS_TOP_CHEST` was: thigh, rise landing marks,
   leggings fractions, layer bulk, shoulder tolerance, and `compression` stretch.
2. A pants rise makes a size bad **only when the band lands below the hip line**. Otherwise it only moves
   where the waist is measured, and says where the band sits.
3. The **men's ANSUR II re-fit** (thigh, rise, heights, possibly inseam 0.45 → 0.47) is a **separate later
   PR**, not in 1a or 1b.
4. **Bras (PR 6) are on hold** until a brand gives garment specs. §4 stays as the design for then.
5. Storage keys are `choudo.*` since the rename (PR #33); §3.2 says `choudo.outfit.v2`.
6. The skin rule's full wording is in [parked-ideas.md](parked-ideas.md).
