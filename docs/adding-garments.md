# Adding a garment by hand

Choudo only trusts numbers it can trace. Every garment row in
`app/src/domain/garments/seed.json` says where it came from, how the chart measures,
and which numbers (if any) are ours rather than the brand's. Follow this checklist
for each new garment. It takes about 15 minutes, plus two for a top's photo.

## Tops: the photo first (about two minutes)

A top can carry a photo, which the mannequin warps onto every size. It's optional:
without one the top is drawn in its `color`. Full details are in
`app/photo-sources/README.md`.

1. **Photograph it.** Lay it flat, front up, sleeves out. Shoot from straight above,
   on a plain floor or sheet that contrasts with it, at the phone's full resolution.
   Keep other clothes and feet out of the frame.
2. **Cut it out.** Save the photo as `app/photo-sources/<garment-id>.jpg` and add a line to
   `app/scripts/garment-photos.json` (`"rotate": 90` if the collar isn't at the top).
   Then run:

   ```bash
   cd app
   npm run photos -- <garment-id>
   ```

   The first run downloads the background-removal model once (224 MB, MIT licence,
   runs locally).
3. **Place the landmarks.** Run `npm run dev` and open
   <http://localhost:5173/dev/landmarks?id=garment-id>.
   - The 13 points start from the shirt's outline: check each one and drag any that
     are off. The front neck is always a guess.
   - Watch the two mannequins. The photo should sit straight at both sizes, with no
     mirrored patches; the page warns if it finds any.
   - Press **Save to seed.json**. This writes the garment's `"image"` entry.
4. **Set the photo's licence** in its `"image"` entry. A newly saved photo starts as
   `"licence": "local-only"`, so it can't ship by accident. Change it to one of:
   - `own`: we took the photo. It's warped onto the mannequin.
   - `brand-permission`: the brand said in writing that we may use it. It's warped.
   - `affiliate-unaltered`: an affiliate image we may only show unaltered. It's never
     warped, so the garment draws in its flat colour.
   - `local-only`: no rights to publish it (a brand's product image without permission,
     or a trademark logo on the garment). It's never warped, and the production build
     leaves the file out.

   `npm run data:check` fails when the licence is missing or not one of these.
5. **Commit the cut-out** (`app/public/garments/<garment-id>-front.png`) with the seed
   change, so a fresh clone shows it. `npm run data:check` fails if it's missing or under
   800 px wide. The exception is a `local-only` photo, which isn't checked. If we don't
   hold the rights to the source photo either (a retailer's model shot), list its PNG in
   `app/.gitignore` too. A git-ignored PNG must be `local-only`, or the check fails. The
   source photo in `photo-sources/` is never committed.
6. **A back photo (optional).** Same steps for a photo of the back: add a second line to
   `garment-photos.json` with `"side": "back"` (the cut-out goes to `<garment-id>-back.png`),
   run `npm run photos -- <garment-id>`, then place its points on the picker's **Back** tab
   (<http://localhost:5173/dev/landmarks?id=garment-id&side=back>). A top's back has the same
   13 points with **Back neck** (`neckBack`, the bottom of the back neckline) in place of the
   front neck; pants use the same 14. They're saved as the garment's `"backImage"`, which takes
   the same licence and the same `data:check` rules as the front. If we don't hold the rights
   to the back photo, list `<garment-id>-back.png` in `app/.gitignore` on its own line (the
   front's line doesn't cover it, and `data:check` doesn't check `local-only` files). Without one, the Fitting
   room's Back view draws the garment in its flat colour; it never uses the front photo.
   Tops and pants only (jackets, skirts, shorts, dresses and leggings take no photo yet).
7. **Then the measurements**, below. If the garment isn't in `seed.json` yet, add its
   row first (steps 1–5) and come back to step 3.

## The numbers

## 1. Find the chart

Look for **garment measurements**: the clothes themselves, laid flat. A chart of
*body* sizes ("fits chest 38–40 in") is not enough on its own. In order of preference:

| Tier | Source | Example |
| --- | --- | --- |
| A | Brand spec sheet | A tech-pack or spec PDF from the brand |
| B | Published garment chart | "Garment measurements" table or PDF on the brand's site |
| C | Partner / print-on-demand API | A print partner's product data for a blank |
| D | Retailer data | A shop's own listing of the garment's measurements |
| E | User-measured garment | Someone measured a real one; no chart at all |
| F | Body-size chart only | Only "fits chest 38–40": no garment numbers |
| G | Photo only | Measured off a product photo |

Tiers E–G grade as **estimated** however carefully they're done.

## 2. Save a snapshot

Save a copy of the chart (the PDF, or a screenshot or saved page) to
`app/chart-snapshots/<garment-id>.<ext>`, e.g. `chart-snapshots/gildan-5000.pdf`. The
folder is git-ignored, like product photos, because the chart isn't ours to
redistribute. The snapshot lets anyone check the row later, even after the brand
changes its page.

## 3. Record the source

```json
"source": {
  "placeholder": false,
  "tier": "B",
  "url": "https://brand.example/size-chart",
  "capturedOn": "2026-11-18",
  "snapshot": "chart-snapshots/brand-tee.pdf",
  "notes": "Anything a reader would need: who reproduced it, what the chart leaves out."
}
```

- `url` is required for every tier except E.
- `capturedOn` is the date you copied the numbers (YYYY-MM-DD).

## 4. Record how the chart measures

Read the chart's labels, diagram or footnotes. **If it doesn't say, write `unknown`.**
Never guess. An unknown definition means that zone can't be scored, and the fit says
"Can't tell". That is the honest answer.

```json
"chart": { "unit": "in", "girth": "flat", "lengthDefinition": "hps", "sleeveDefinition": "shoulder_to_cuff" },
"fitIntent": "regular"
```

| Field | Values | How to tell |
| --- | --- | --- |
| `unit` | `in`, `cm` | As printed. Don't convert. |
| `girth` | `flat`, `circumference`, `unknown` | "Laid flat", "pit to pit" or "½ chest" means `flat`. "Chest" with no word on method means `unknown`. |
| `lengthDefinition` | `hps`, `center_back`, `waist`, `unknown` | Tops and skirts. "High point of shoulder" or "from shoulder" means `hps`. "Centre back" or "back neck" means `center_back` (scored on knits only). Skirts: `waist` when the length runs from the top of the waistband (a skirt's "centre back length" does); tops can't use it. |
| `sleeveDefinition` | `shoulder_to_cuff`, `center_back_to_cuff`, `top_of_sleeve` | Leave it out if there's no sleeve row. |
| `fitIntent` | `slim`, `regular`, `relaxed`, `oversized` | How the brand describes the cut. |
| `sizing` | `mens`, `womens`, `unisex` | Who the size chart is cut for. Decides who sees it by default and, for tops, which chest thresholds apply (women's cuts sit closer). Anything else is an error. |
| `stretch` | `none`, `some`, `high`, `compression` | How much the fabric gives. Elastic waistbands are `high`; `compression` is for leggings. Knits: `{ "default": "none", "hemBand": "high" }` for a rib hem. |
| `stretchAssumed` | `true` | When the chart gives no stretch data and the level is ours (a spandex legging read as `compression`). The readout and `npm run data:check` say so. Leave it out when the chart or product page states the stretch. |
| `hemBand` (a size measurement) | number | Knits: the rib hem band, relaxed (a girth, so flat or full as `girth` says). Few charts print it; an estimate needs `origin: "estimated"` and a `how`. |
| `weight` | `light`, `mid`, `heavy` | Optional fabric bulk: what a garment adds under a jacket (`domain/fit/layers.ts`). Leave out for the template's default: tees light, knits and jackets mid. A heavy fleece (9 oz and up) is `heavy`. |
| `category` for dresses | `onepiece` | Dresses (`type` `dress`) take the place of the top and the bottom. They need a sleeve (`short` or `long`; sleeveless isn't supported yet) and a length definition (`hps` or `center_back`). |
| `category` for jackets | `outer` | Jackets and coats (`type` `jacket` or `coat`) go in the `outer` slot and need a length definition (`hps` or `center_back`). A shoulder row is scored when printed; a sleeve from the centre back is `center_back_to_cuff`. |

When a chart mixes methods, or a garment stretches in one place only, give the field per
measurement with a `default` for the rest. Definitions can also go in one
`definitions` object (not both spellings for the same one):

```json
"stretch": { "default": "none", "waist": "high" },
"chart": { "unit": "cm", "girth": { "default": "circumference", "hips": "flat" }, "definitions": { "rise": "front" } }
```

| `definitions.` | Values | How to tell |
| --- | --- | --- |
| `length`, `sleeve` | as `lengthDefinition`, `sleeveDefinition` above | Either spelling works. |
| `rise` | `front`, `back`, `total`, `unknown` | Pants. "Front rise" means waistband top to crotch seam, at the front. |
| `thigh` | `at_crotch`, `below_crotch_2_5cm`, `unknown` | Pants. Many charts measure 1 in (2.5 cm) below the crotch. |
| `waistSeam` | `natural`, `empire`, `drop`, `none`, `unknown` | Dresses only: where the waist seam sits. A sheath shaped by darts, with no seam, is `none`. The waist is scored at `natural` and `none` (at the navel); empire, drop and unknown leave it unscored. Product copy ("seamed waist", "empire waist", "waistband") usually says. |
| `waist` | `natural`, `mid`, `low`, `unknown` | Skirts: where the band sits. Charts rarely say; the product copy often does ("sits at the natural waist", "mid-rise"). Without it the band sits at the navel. |

Pants measurements: `waist`, `hips`, `inseam`, `rise`, and, when the chart lists them,
`thigh`, `knee` and `legOpening`. Thigh, knee and leg opening are girths: flat widths are
doubled like the waist (give `girth` per measurement if the chart mixes methods). The rise
only places the waistband when `definitions.rise` is `front`; the thigh is only scored with
`definitions.thigh`. If the hem opens with a zip, add `"ankleZip": true` (a narrow opening
then still gets over the heel).

Shorts (`"type": "shorts"`) take the pants measurements. Their inseam isn't compared with
yours: it says where the hem lands (mid-thigh, above the knee, at the knee), and there's
no leg-opening zone. A "bottom opening" row is `legOpening`.

Skirts (`"type": "skirt"`) give `waist`, `length` (with `definitions.length: "waist"`),
and, when the chart lists them, `hips` and `hemSweep` (the hem's circumference, "sweep":
a girth, doubled when flat). Set `definitions.waist` from the product copy. If the chart
says where it measures the hips ("hip 7 in below the waist"), give
`"chart": { …, "hipsBelowWaist": 7 }` in the chart's unit; without it the hips are compared
at the fullest. The sweep is checked against a full stride at the hem ("walking room");
without one that zone is left unscored.

Dresses (`"type": "dress"`, `"category": "onepiece"`) give `chest` (the bust) and `length`
(from the high point of the shoulder, or the centre back), and, when the chart lists them,
`waist`, `hips`, `hemSweep`, `shoulder` and `sleeve`. The waist is compared at the seam
(`definitions.waistSeam`), the hips at the fullest, the hem lands against the knee (mini to
maxi, as a skirt's) and the sweep is checked for walking room. A "back only" chest (half the
back, not the full bust) can't be turned into a girth: leave that dress out.

Leggings (`"type": "leggings"`, `"category": "bottom"`) give `waist` and `inseam`, and when
the chart lists them `hips`, `thigh` (with `definitions.thigh`) and `calf` (a girth, last in the
key list). They're compared as a share of the body (meant to sit under it), the waist where
the band sits, and the inseam lands against the ankle bone (capri / 7/8 / ankle / long). Hips
are required, as for pants: a chart without them reads "can't check". Sport-Tek prints the
waistband "point to point when laid flat", so `girth: "flat"`. If the chart gives no stretch
figure, use `compression` for a spandex legging and set `stretchAssumed: true`.

## 5. Copy the numbers exactly as printed

- Copy every size row as printed: same unit, same flat/round, fractions as decimals
  (28 ½ becomes 28.5).
- Don't double flat widths and don't convert inches. `normalizeGarment` does both,
  and records each step.
- Leave out measurements the chart doesn't list. Don't fill them in.
- If you *must* add a number the chart doesn't give, mark it and say how:

  ```json
  "sleeve": { "value": 8.5, "origin": "estimated", "how": "midway between the S and L rows" }
  ```

  Any estimated value grades the whole garment as **estimated**, and the fit readout
  shows "est." next to it.

## 6. Run the check

```bash
cd app
npm run data:check
```

The report shows each garment's grade, source, snapshot status, errors, warnings,
and zones it can't score:

- **Errors** block the garment: it's left out of the app and `npm run check` fails.
  Typical causes:
  - a size that's smaller than the one before
  - a "flat" chest that's really a circumference, or the reverse
- **Warnings** need a person to look:
  - uneven grading
  - a value outside the usual range for the garment type
  - chest ease that doesn't match the fit intent

  Re-read the chart. If it really says that, leave it and add a note to `source.notes`.

Thresholds live in `app/src/domain/garments/verifyRules.ts`.

## 7. Audit (optional, but it's the only way to "Verified")

Buy or borrow one real garment and lay it flat on a table. Measure:

- **Chest:** pit to pit.
- **Length:** from the high point of the shoulder (or however the chart measures it).
- **Anything else** the chart lists.

Then record it:

```json
"audit": {
  "measuredSize": "M",
  "measuredOn": "2026-11-20",
  "afterWash": true,
  "unit": "in",
  "measurements": { "chest": 20.25, "length": 28.75 },
  "notes": "Washed once, tumble dried."
}
```

- Girths are flat widths; we double them.
- `data:check` lists the difference from the chart for each measurement, and warns past
  3 cm (girth, full circumference) or 2 cm (length).

## Confidence grades

| Grade | Badge | When |
| --- | --- | --- |
| verified | Verified | Tier A–C, no errors or warnings, audited |
| charted | From size chart | Tier A–D, no errors, not audited (or audited with warnings) |
| estimated | Estimated | Any estimated value, a placeholder, or tier E–G |
| unscored | Can't score | The girth method or (for tops) the length definition is unknown |

The rules are checked top to bottom: **unscored** wins over everything, then **estimated**.

## Placeholders

Rows with `"placeholder": true` are invented for development, under made-up brands.

- They have no tier, because they come from no source. Tier G would wrongly claim a photo.
- They grade as **estimated** and show "Sample data".
- Replace them with real, cited rows before trusting any fit result.
