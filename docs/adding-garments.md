# Adding a garment by hand

Nimbus only trusts numbers it can trace. Every garment row in
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
4. **Then the measurements**, below. If the garment isn't in `seed.json` yet, add its
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
| `lengthDefinition` | `hps`, `center_back`, `unknown` | Tops only. "High point of shoulder" or "from shoulder" means `hps`. "Centre back" or "back neck" means `center_back`. |
| `sleeveDefinition` | `shoulder_to_cuff`, `center_back_to_cuff`, `top_of_sleeve` | Leave it out if there's no sleeve row. |
| `fitIntent` | `slim`, `regular`, `relaxed`, `oversized` | How the brand describes the cut. |
| `sizing` | `mens`, `womens`, `unisex` | Who the size chart is cut for. Decides who sees it by default and, for tops, which chest thresholds apply (women's cuts sit closer). Anything else is an error. |

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
