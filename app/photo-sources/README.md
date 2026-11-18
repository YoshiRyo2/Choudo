# Garment photo sources

Product photos used as garment textures. **They are not committed**: we don't hold
the rights to redistribute them, so this folder and `public/garments/` are
git-ignored. Without a photo the app draws the garment in its flat colour.

To use a photo locally:

1. Save it here under the name given in `scripts/garment-photos.json`
   (e.g. `gildan-5000.webp` — the front view of the model shot on the product page).
2. Run `npm run photos` to cut the garment out into `public/garments/`.
3. `npm run photos -- --overlay` also writes `…-overlay.png` with the landmarks
   from `seed.json` drawn on, to check them by eye.

The landmark pixel positions in `seed.json` refer to the cut-out PNG, so if you
change the crop or the `bleed` in `garment-photos.json`, re-check them with the
overlay. (`bleed` pads the garment by smearing its edge colours outward, so the
cut-out isn't a clean silhouette; that's on purpose. The Mannequin warps the
photo onto each size's outline, and the padding gives a slightly larger outline
cloth at its edges instead of a gap.)
