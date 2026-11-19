# Garment photo sources

Photos used as garment textures. **They are not committed**: product photos aren't
ours to redistribute, and photos of your own clothes are personal. This folder and
`public/garments/` are git-ignored. Without a photo the app draws the garment in its
flat colour.

## Taking the photo

- Lay the shirt **flat, front up**, smoothed out, sleeves straight out from the body
  (not folded under). Long sleeves can angle down; keep the cuffs in the frame.
- Shoot from **straight above**, so the shirt isn't a trapezoid. Stand over it.
- A **plain floor or sheet that contrasts with the shirt** is best (a white tee on a
  dark floor, a black one on a light sheet). Wood grain and rugs are fine; the
  remover copes, it just has to work harder.
- Keep **other clothes, feet and shadows** away from the shirt's edges.
- Use the **original file** (full resolution, straight off the phone). Don't crop or
  screenshot it; the script reads the EXIF orientation.

## Cutting it out: `npm run photos`

1. Save the photo here as `<garment-id>.jpg`. JPEG, PNG and WebP work. An iPhone's
   HEIC doesn't, so export it as JPEG first (or set Camera → Formats → Most Compatible).
2. Add it to `scripts/garment-photos.json`:

   ```json
   { "id": "ryo-black-henley", "source": "photo-sources/ryo-black-henley.jpg", "rotate": 90 }
   ```

   `rotate` (degrees clockwise, after EXIF) is only needed if the collar isn't at the
   top: photos taken sideways usually need `90` or `270`.
3. Run `npm run photos -- <garment-id>` (or no id for every photo). It writes
   `public/garments/<garment-id>-front.png`, about 20 seconds per photo.

The first run downloads the background-removal model (224 MB, once) into
`app/.models/` (git-ignored). It's **BiRefNet-lite**, run locally with ONNX
Runtime: MIT licence for the code and the weights, so fine for a commercial app.
Nothing is uploaded anywhere.

What the script does to each photo:

- turns it upright (EXIF orientation, then `rotate`)
- finds the garment with the model, keeps the biggest piece, fills holes
- crops to it and shrinks the PNG to at most `maxSide` (900) px
- trims `erode` (3) px off the edge, so no floor shows at the outline
- pads `pad` (24) px round it with the nearest garment colour, fading into
  the shirt's median colour

The padding is on purpose. The mannequin stretches the photo onto each size's
outline, and those never match the photo's exactly, so this keeps every edge in the
shirt's own colour.

`method: "colour"` is the older colour-matching cut-out (`gildan-5000`). Use it for a
solid-colour garment **worn by a model**, where the AI cut-out would keep the person.

`npm run photos -- --overlay` also writes `…-overlay.png` with the saved landmarks
drawn on, for a quick check.

## Placing the landmarks: `/dev/landmarks`

Run `npm run dev` and open <http://localhost:5173/dev/landmarks?id=garment-id>.
The page only exists on the dev server, not in the built app.

- The 13 points start where the garment's outline suggests: collar, front neck,
  shoulders, sleeve-opening corners, armpits, hem corners. Usually you only nudge them.
  **Front neck** is always a guess, because the outline shows the back of the neck.
- **Click** the photo to place the highlighted point (the diagram shows which).
  **Drag** a point to move it, or use the **arrow keys** (shift moves 10 px).
- "Left" and "right" are as you look at the photo.
- The two mannequins show the photo warped onto the smallest and largest size as
  you go. A one-size garment gets a made-up bigger size for the preview.
- **Save to seed.json** writes the garment's `"image"` entry and nothing else.
  **Copy JSON** copies it instead.

The landmarks are pixels of the PNG. If you change `rotate`, `maxSide`, `erode` or `pad`
and re-run `npm run photos`, place them again.
