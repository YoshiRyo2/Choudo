# Native app PR 4: Mannequin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 2D mannequin on the phone, drawn identically to the web one: body, mascot head and face, height tape, every garment template (tops, knits, pants, shorts, skirts, leggings, dresses, jackets over a top or dress), fit pins, and photo warping, then shown on the Body screen and in a dev-only lab screen for checking it on the phone.

**Architecture:** A `react-native-svg` port of `app/src/ui/components/Mannequin/Mannequin.tsx` (426 lines) and `MascotHead.tsx`. Every shape and position already comes from `@choudo/core/ui-logic/components/Mannequin/*` (`bodyGeometry`, `topShape`, `pantsShape`, `skirtShape`, `leggingsShape`, `dressShape`, `jacketShape`, `warpPieces`, `warpPantsPieces`, `headShape`, `faceShape`, `viewPhoto`); the phone version only paints them. CSS becomes a paint table in TypeScript, because iOS has no stylesheet, `color-mix` or `filter`. The component keeps the web's props, so a 3D mannequin can replace it later behind the same interface.

**Tech Stack:** Expo SDK 58, `react-native-svg` 15.16 (already installed), `expo-asset` / `Image.resolveAssetSource` for photo sizes, Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-11-23-native-iphone-app-design.md` (step 4; the "Mannequin" bullet). The 3D test (`claude/3d-mannequin-test.md` in the project) is still running; nothing here depends on its outcome.

## Global Constraints

- Skin rule: body proportions come only from the core functions above; no path string, point or height is changed or recomputed in `mobile/`. Heads and faces are drawing only.
- Same props as the web `Mannequin` (`body`, `top`, `bottom`, `onepiece`, `outer`, `showFit` (default true), `photos` (default `'licensed'`), `frame` (default `'canvas'`), `view` (default `'front'`), `showHeightTape` (default true), `head`, `face` (default `'unknown'`)), plus `style`. Same `WornGarment` type. Same draw order as the web component, line for line.
- Same view box: `VIEW = { left: -62, right: 62, top: -6 }`; height `frame === 'body' ? heightCm + 10 : Math.max(214, heightCm + 10)`. `preserveAspectRatio` default (`xMidYMid meet`), like the web `<svg>`.
- Line widths given in px on the web (`vector-effect: non-scaling-stroke`: form 2.2, seam 1.2 with dash 3 4, head halo 4.4, ears/leaf 2.2, crease 1.6, face lines 2) are converted to view-box units from the rendered width: `px(n) = n * 124 / renderedWidth` (124 = view-box width), measured with `onLayout`. Don't rely on `vectorEffect`. Widths given in view-box units on the web (garments 0.35, folds, pins, tape) stay as they are.
- `color-mix(in srgb, A p%, transparent)` → colour A with `opacity p` (`strokeOpacity` / `fillOpacity`); `color-mix(A p%, B)` → a precomputed hex from `mixHex`; `filter: brightness(0.92)` on rib bands → `shadeHex(color, 0.92)`.
- Only photos whose licence allows it ever ship in the app bundle: `own`, `brand-permission`, `affiliate-unaltered` (the last only for thumbnails later; only `canWarp` photos are warped). `local-only` files are never `require`d.
- No size-change animation in this PR (the web's 220 ms path transition comes with the Fitting room, PR 5).
- Root `npm run check` passes at every commit; golden tests untouched.

## Review Focus

1. Line weights at different sizes — the outline is the same 2.2 pt on the small Body-screen preview and on a full-width figure. Pinned in Task 2 (`px` test at two widths).
2. A garment with a size label it doesn't have (stale stored outfit) — drawn bare, no crash, same as web. Pinned in Task 4.
3. A photo missing from the bundle, or local-only — the flat colour is drawn, no red screen. Pinned in Tasks 1 and 4.
4. Bodies at the input limits (shortest and tallest `INPUT_LIMITS` heights, both body types) — the whole figure and tape stay inside the view box. Pinned in Task 4.
5. Warped photos making changes slow on the phone — checked by hand in the lab screen (Task 6): switching between the three photo tops (`ryo-grey-polo`, `ryo-cream-boxy-tee`, `ryo-black-henley`; each has one size, "Mine") and stepping the height should feel instant on Ryo's iPhone. If it doesn't, the PR says so; moving the mannequin to Skia is then its own PR before the Fitting room.

### Task 1: Bundled garment photos

**Files:**
- Create: `mobile/scripts/garment-photos.mjs` (writes the map), `mobile/src/components/mannequin/garment-photos.ts` (generated, committed), `mobile/src/components/mannequin/garment-photos.test.ts`
- Modify: `mobile/package.json` (script `"photos": "node scripts/garment-photos.mjs"`)

**Interfaces:**
- Consumes: `GARMENTS` (`@choudo/core/domain/garments`), each garment's `image` / `backImage` (`file`, `licence`).
- Produces:
  - `GARMENT_PHOTOS: Record<string, number>` — key = the image's `file` as written in `seed.json` (e.g. `garments/ryo-black-henley-front.png`), value = `require('../../../../app/public/<file>')`. Only `own`, `brand-permission` and `affiliate-unaltered` images, sorted by key; the file header says it's generated by `npm run photos -w @choudo/mobile`.
  - `photoSource(file: string): { module: number; width: number; height: number } | null` — `null` for files not in the map; width/height from `Image.resolveAssetSource(module)`.

- [ ] Step 1: Write the failing test `garment-photos.test.ts`: every key in `GARMENT_PHOTOS` belongs to an image whose licence isn't `local-only`; every image in `GARMENTS` with licence `own` / `brand-permission` / `affiliate-unaltered` has a key; `ryo-navy-graphic-tee` and `gildan-5000` files are absent; `photoSource('garments/nope.png') === null`.
- [ ] Step 2: Run `npm test -w @choudo/mobile -- garment-photos`. Expected: FAIL.
- [ ] Step 3: Write the script, run it, commit its output; implement `photoSource`.
- [ ] Step 4: Run `npm run check -w @choudo/mobile`. Expected: PASS. Run `npx expo export -p ios` from `mobile/`. Expected: bundles (Metro resolves the `app/public` files).
- [ ] Step 5: Commit `Mobile: bundled garment photos (licensed only)`.

### Task 2: Paint table, colour helpers, px conversion

**Files:**
- Create: `mobile/src/utils/color.ts`, `color.test.ts`; `mobile/src/components/mannequin/paint.ts`, `paint.test.ts`

**Interfaces:**
- Produces:
  - `mixHex(a: string, b: string, aShare: number): string` — sRGB mix like `color-mix(in srgb, a aShare%, b)`, lowercase `#rrggbb`.
  - `shadeHex(hex: string, factor: number): string` — each channel × factor, clamped (CSS `brightness()`).
  - `px(n: number, renderedWidth: number): number` = `n * 124 / renderedWidth`; `renderedWidth ≤ 0` → returns `n * 124 / 300`.
  - `paint` — one object of SVG props per web class, values copied from `Mannequin.css` with the conversions in Global Constraints: `form`, `arm` (fill `mixHex(colors.form, colors.peachTint, 0.55)`), `seam`, `stand`, `garment`, `garmentApproximate`, `garmentEstimated`, `garmentEdge`, `fold`, `strain`, `rib`, `ribLine`, `placket`, `hoodEdge`, `cord` (`mixHex(colors.surface, colors.ink, 0.8)`), `pin` per tone (`good` / `warn` / `bad` use `colors.fitGood` / `fitWarn` / `fitBad`; `unknown` a hollow ring: fill `colors.bg`, stroke `colors.muted`, width 0.5), `tape`, and the head parts `headHalo`, `headFill`, `headFillPeach`, `ear`, `earInner`, `leaf`, `crease`, `eye`, `faceLine`, `blush`. Px-based widths are functions of `renderedWidth`.

- [ ] Step 1: Write the failing tests: `mixHex('#ffffff', '#000000', 0.5) === '#808080'`; `mixHex(colors.form, colors.peachTint, 0.55)` equals the hand-worked value; `shadeHex('#ff0000', 0.92) === '#eb0000'`; `px(2.2, 124) === 2.2`, `px(2.2, 248) === 1.1`; `paint.form(124).strokeWidth === 2.2`; `paint.garmentApproximate.strokeDasharray` is `[1.4, 1]`.
- [ ] Step 2: Run them. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] Step 5: Commit `Mobile: mannequin paint table and colour helpers`.

### Task 3: Mascot head and height tape

**Files:**
- Create: `mobile/src/components/mannequin/mascot-head.tsx`, `height-tape.tsx`, `mascot-head.test.tsx`
- Create: `mobile/src/hooks/use-head.ts`; `mobile/src/components/mannequin/head-context.ts`
- Modify: `mobile/src/app/_layout.tsx` (provide the stored head)

**Interfaces:**
- Consumes: `headShape`, `faceShape`, `headAnchor`, `HeadKind`, `isHeadKind` (core); `paint`.
- Produces:
  - `MascotHeadContext` (default `'cloud'`) and `useHead(): [HeadKind, (h: HeadKind) => void]` on `STORAGE_KEYS.head`.
  - `<MascotHead kind face: FitTone | null at: HeadAnchor renderedWidth>` — the web component's parts in the same order (ears, leaf, halo circles, fill circles, crease, face), `testID="mascot-head"`.
  - `<MascotHeadIcon kind>` — the web icon (view box `-15 -29.5 30 31`, 30×31 pt, face `good`, lighter lines 3 / 1.5 / 1.4 px) for PR 5's head picker.
  - `<HeightTape heightCm x>` — the web `HeightTape`: ticks every 2 cm, long every 10, numbers every 20, the reading `"{round(height)} cm"`; text in `fonts.bold`, sizes 2.6 and 3.6 view-box units.

- [ ] Step 1: Write the failing test `mascot-head.test.tsx`: for each of `cloud`, `peach`, `bunny` the number of circles equals `headShape(kind, at).puffs.length × 2`; `peach` fills use `colors.brand`; `face={null}` draws no eyes or mouth; `face="bad"` draws `faceShape('bad', …).mouthPath`.
- [ ] Step 2: Run it. Expected: FAIL.
- [ ] Step 3: Implement the head, icon, tape, hook and provider.
- [ ] Step 4: Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] Step 5: Commit `Mobile: mascot heads and height tape`.

### Task 4: The Mannequin

**Files:**
- Create: `mobile/src/components/mannequin/index.tsx` (`Mannequin`, `WornGarment`), `photo-texture.tsx`, `mannequin.test.tsx`, `skin.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3; the core shape functions named in Architecture; `affineToSvg` (photo transform: pass the same `matrix(...)` string, or the six numbers, to the `G`/`Image` `transform`).
- Produces: `<Mannequin {...web props} style?>` and `type WornGarment = { garment: Garment; sizeLabel: string; fit?: GarmentFit }`.
- Behaviour: a straight port of the web component, top to bottom: tape, stand, hood behind, body form (arms, torso, feet ellipses, neck rect), head (`headAnchor(g.head)`, no face from the back), seam, bottom (+ pants photo pieces), skirt, top (+ photo pieces, creases, dress skirt, arms unless a jacket, sleeves, hood on back, knit rib/hood/cords), jacket (body, creases, arms, sleeves, collar, placket, hood on back), pins. Clip-path ids from `useId()` with non-word characters stripped, as web. `accessibilityRole="image"` and `accessibilityLabel` = the web `label` string. `renderedWidth` from the root `View`'s `onLayout` (0 until measured; then `px` falls back as in Task 2).
- `PhotoTexture`: the web structure (outline clip, one triangle clip per piece, `Image` with `preserveAspectRatio="none"`, the garment edge redrawn on top); sizes come from `photoSource`, so no async loading hook is needed.

- [ ] Step 1: Write the failing tests `mannequin.test.tsx` (use `estimateBody(...).measurements` and `findGarment` as the web `skin.test.tsx` does):
  - every `d` string in `bodyGeometry(body).paths` (torso, both arms) appears on a rendered `Path`, unchanged;
  - with `top: gildan-5000 L` every path of `topShape(...)` (`body`, both `sleeves`) is rendered unchanged; the photo isn't (Gildan's is local-only), so no `Image` is rendered;
  - with `top: ryo-black-henley` in its one size (`Mine`) an `Image` per warp piece is rendered;
  - `showFit` with a `fit` from `fitGarment` renders one pin per zone that has a marker, coloured by tone;
  - a `WornGarment` whose `sizeLabel` isn't one of its sizes renders like the bare body, no throw;
  - the accessibility label matches the web wording for "tee and chinos" (`Mannequin, 182 cm tall wearing Gildan … in L and …`);
  - at the shortest and tallest `INPUT_LIMITS` heights, both body types, the feet ellipses and the tape's top are inside the view box.
- [ ] Step 2: Write the failing test `skin.test.tsx`: the web skin test's six outfits × three heads × faces × front/back: the rendered tree with the `mascot-head` subtree removed is identical (`toJSON`) across heads and faces.
- [ ] Step 3: Run both. Expected: FAIL.
- [ ] Step 4: Implement `index.tsx` and `photo-texture.tsx`.
- [ ] Step 5: Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] Step 6: Commit `Mobile: the mannequin (all templates, pins, photo warp)`.

### Task 5: Body screen preview

**Files:**
- Modify: `mobile/src/screens/body/index.tsx` (replace the `mannequin-slot` box with `<Mannequin body={preview.body} showFit={false} />` in the same box; accessibility label from the web: "Mannequin preview, a typical body until you enter yours" / "Mannequin preview of your body")
- Modify: `mobile/src/screens/body/body-screen.test.tsx`

- [ ] Step 1: Write the failing test: the Body screen renders a mannequin with the "typical body" label before height and weight are valid, and "of your body" after 170 / 65.
- [ ] Step 2: Run it. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] Step 5: Commit `Mobile: mannequin preview on the Body screen`.

### Task 6: Dev-only mannequin lab, docs

**Files:**
- Create: `mobile/src/app/dev/mannequin.tsx` (route `/dev/mannequin`), `mobile/src/screens/dev/mannequin-lab.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx` (a "Mannequin lab" button shown only when `__DEV__`), `CLAUDE.md` (`mobile/src/components/mannequin/`, `scripts/garment-photos.mjs`, the lab)

**Interfaces:**
- The route redirects to `/` unless `__DEV__`, so it never works in a store build.
- The lab: the stored body (or `PREVIEW_BODY.womens`) with a height stepper (−5 / +5 cm, kept inside `INPUT_LIMITS`, never saved); segmented controls for head (cloud / peach / bunny), face (good / warn / bad / unknown), view (front / back), frame (canvas / body); a garment picker over all of `GARMENTS` grouped by category (top, bottom, onepiece, outer) and a size row for each slot; fit pins on, using `fitGarment` (and `fitOutfit` for a jacket over a top), as the web Fitting room does.

- [ ] Step 1: Implement the route and lab (no tests beyond a render smoke test: the lab renders with an empty store).
- [ ] Step 2: Run root `npm run check` and `npx expo export -p ios`. Expected: PASS, bundles.
- [ ] Step 3: In the PR description, list Ryo's phone checks (Expo Go): the Body-screen preview grows as height is typed; in the lab, compare with the website side by side for gildan-5000 L (flat colour: its photo is local-only), the three photo tops, chinos, the A-line skirt, a dress, a jacket over the hoodie, LPST880 leggings, all three heads, front and back; switching between the photo tops and stepping the height feel instant; outlines look the same weight on the Body screen and in the lab.
- [ ] Step 4: Commit `Mobile: dev-only mannequin lab; docs`.
