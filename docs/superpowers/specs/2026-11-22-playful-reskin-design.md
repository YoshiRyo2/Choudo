# Playful re-skin (PR 1) — design

Date: 2026-11-22. Branch: `claude/reskin-playful-1`. Presentation only.

## Why
Choudo looks like a measuring tool. The tailor's-fitting-room style (pattern-paper
white, a linen dress form, tape-measure yellow, condensed Barlow) and screens that lead
with numbers read as technical and dull. Our audience is young women who shop online for
fashion. They want a plain answer ("will M fit me?") and to see it on a figure, not a
table of centimetres.

New direction: **soft and playful**: peach and blush, rounded type, a friendly
mascot-like mannequin. The Fitting room leads with the answer and the dressed
mannequin; the numbers are one tap away.

## Goals
- A warm, friendly look across every screen, from tokens and type alone.
- Fitting room: a headline answer ("M fits you"), the mannequin big on a peach circle,
  sizes as round pills, and a "See fit details" button that opens the zone-by-zone sheet.
- No numbers on the main Fitting room screen. Zones, tape scales, cm values and odds
  live in the Fit details sheet.
- Everything stays accessible: text contrast ≥ 4.5:1, touch targets ≥ 44 px, visible
  focus, `prefers-reduced-motion` respected.

## Non-goals (this PR)
- No change to fit logic, thresholds, zone results or verdict wording.
  `domain/fit/golden.test.ts` and `__golden__/` stay byte-for-byte the same.
- No change to body proportions: the mannequin's shoulders, bust, waist, legs and height
  are exactly what the fit engine computes. The re-skin is a surface on top.
- No layout changes to Body, Anchor, Discover, Closet or About: only new tokens and type.
- No change to garment drawing or photo warping on the mannequin.
- No new illustrations, mascot face or animation (later PRs).

## Anti-goals (don't do these, ever, in this direction)
- Gradients, glassmorphism / backdrop blur, emoji, soft grey drop shadows.
- Fit colours used for anything other than fit results.
- Cute copy that hides honesty: "Saved on this device only" and "From size chart" stay.
  The women's chest zone stays "Bust".
- Hardcoded colours in components: every colour is a CSS custom property.

## Tokens (`app/src/ui/styles.css`)

| Token          | Value     | Job |
|----------------|-----------|-----|
| `--bg`         | `#fff4ee` | page background |
| `--surface`    | `#ffffff` | cards, sheet, tab bar, selected segment |
| `--ink`        | `#2a2140` | text, primary buttons, outlines, mannequin edge and stand |
| `--muted`      | `#6b5f73` | secondary text |
| `--brand`      | `#ffb59e` | identity; fills only (wordmark, tape scale in the sheet) |
| `--peach-soft` | `#ffcfbd` | mannequin circle, current tab pill |
| `--peach-tint` | `#ffe2d6` | segmented-control track, quiet fills, card picture wells |
| `--line`       | `#ffd6c7` | hairlines, field borders |
| `--blush`      | `#ff9c86` | accent fills (never text) |
| `--stamp`      | `#c8372d` | the "Suggested" tag on a size pill |
| `--form`       | `#fff7f2` | the mannequin's body |
| `--fit-good`   | `#2b7353` | fit results only |
| `--fit-warn`   | `#a0571a` | fit results only |
| `--fit-bad`    | `#c2362f` | fit results only |

Removed: `--paper`, `--paper-raised` (renamed `--bg` / `--surface`), `--tape`, `--form-edge`,
`--chalk-*` (renamed `--fit-*`), `--font-numeric`, `--on-brand`.

Contrast (measured): ink ≥ 7.4:1 on every fill. Muted, the fit colours and stamp are
≥ 4.5:1 on `--bg`, `--surface` and `--form` only — **not** on `--peach-soft`, `--brand`
or `--blush`. Muted is 4.87:1 on `--peach-tint` (OK for the segmented track); fit colours
are not (4.4–4.6), so no fit text on peach-tint. Focus ring: 2 px `--ink`.

Radius: pills `999px`, cards `18px` (`--radius-card`), sheet `28px` top corners
(`--radius-sheet`), small fields `12px` (`--radius-s`).

Borders instead of shadows: raised things get a 1.5 px `--line` border, never a blur shadow.

## Type
M PLUS Rounded 1c, self-hosted from `@fontsource/m-plus-rounded-1c`, weights 500 / 700 /
800, **Latin subset only** (`latin-500.css` etc.). Barlow and Barlow Condensed removed.
Numbers keep `font-variant-numeric: tabular-nums` (`.num`) in the same family.

| Role     | Size / weight |
|----------|---------------|
| headline | 42 / 800 (`--type-headline`) |
| title    | 22 / 800 (`--type-title`) |
| body     | 16 / 500 |
| small    | 13–14 / 500 |

## Fitting room layout (phone, top to bottom)
1. **Garment row.** Garment name (15/700) over brand (14/500, muted). On the right, the
   Front/Back SegmentedControl as a peach-tint pill track, selected segment white.
2. **Headline.** Names the suggested size (`recommendSize` via the garment's odds):
   "{size} fits you" only when that size's own verdict is a confident good fit (tone good,
   likeliest verdict ≥ `CERTAINTY.probably`, i.e. "Very likely …" / "Probably …", and not a
   close call); otherwise "Your best bet: {size}". It is judged on the suggested size even
   when another size is selected. Under it, one line from the existing verdict text for the
   selected size (`verdictLine(...).headline`). When the selected size isn't the suggested
   one, that line says which size is shown ("Showing L: Probably roomy"). With no
   suggestion, the existing fallback copy (`sizeLine(size, false)`: "Size M · we couldn’t
   pick one for you") is the headline, with the verdict line under it. No new verdict wording.
3. **Mannequin** on a 316 px `--peach-soft` circle; no height tape on this screen.
4. **SizePicker**: round pills 48 px tall; selected = ink fill, white text. The fit dot
   and the "Suggested" tag stay.
5. **"See fit details"**: an outline pill (2 px ink border) that opens the existing Sheet
   with FitReadout zones, TapeScale, cm values and odds.
6. **Browse panel** (Top / Bottom / Dress / Jacket, carousel) under that, unchanged in
   function; restyled with the new tokens.
7. **TabBar**: a floating white pill bar, the current tab on a `--peach-soft` pill. Same tab
   names.

Edit body, units and Save outfit stay in the header row above the garment row.

## Mannequin (this PR: colours only)
Body `--form` with a 2.2 px `--ink` outline (non-scaling stroke), a rounded ink stand
under the feet in place of the floor line. Arms a step towards `--peach-tint` so they read
over the torso. Garment drawing, photo warping and pins unchanged.

## Other screens
Body, Anchor, Discover, Closet, About: new tokens and type only. Gradients and grey shadows
there are swapped for flat fills and borders (an anti-goal fix, not a layout change).

## Testing
- `npm run check` and `npm run build` pass; golden files untouched.
- Pure headline logic (`fittingHeadline` in `fitText.ts`) unit-tested: likely fit, "Might"
  fit, close call, bad tone, another size selected, and no recommendation.
- Component tests (jsdom + Testing Library) for the Fitting room headline cases and for
  opening and closing Fit details.
- 390 px screenshots of every screen in the PR.

---

# PR 2: mascot — design

Date: 2026-11-22. Branch: `claude/reskin-playful-2` (from `main` after PR 1). Presentation only.

## Goals
- A mascot head on the mannequin wherever it is drawn (Body, Fitting room, Discover,
  Closet): **cloud** (default), **peach** or **bunny**, picked in the Fitting room and
  remembered on the device.
- A face that reacts to the fit of the size shown.
- A ちょうど ("just right") seal that lands on the Fitting room stage when the size shown
  is the suggested size and it fits, with a small hop of the figure.

## Non-goals and hard rules
- Same as PR 1: no change to fit logic, thresholds, zone results, verdict wording or
  `domain/fit/__golden__/`.
- **Skin rule.** The head, face and motion are a rendering skin. Body geometry (neck,
  shoulders, bust, waist, hips, legs, height) and garment shapes are byte-for-byte what
  they were: `bodyGeometry` is not touched, and a test renders the Mannequin with each head
  and checks everything outside the head group is the same markup.
- The motion is a translate of the whole figure; the body is never scaled.
- Tokens only, no hardcoded colours. No emoji, gradients or sparkles.

## Heads (`Mannequin/heads.ts`, pure; drawn by `Mannequin/MascotHead.tsx`)
The old head ellipse (`g.head`) is replaced by the head drawing, in the same place in the
paint order (over the neck). Each head is laid out from `g.head` only: centred on its `cx`,
its bottom on `cy + ry` (the chin, so it overlaps the neck's top), and sized in units of
`w = g.head.rx`, so it scales with the head the geometry already uses. Everything fits in
the old head's height (`2 × ry ≈ 2.96 w`), so the figure is no taller.

**`HEAD_SCALE = 1.3`** (in `heads.ts`, applied in `headAnchor`: `w = g.head.rx × HEAD_SCALE`;
2026-11-23, first 1.15, then raised to 1.3). The head is drawn 30 % bigger than the body
geometry's head. Its bottom stays on the chin, so it grows up and out, never down into the
neck. The face, blush, ears, leaf and crease grow with it, the outline widths don't
(non-scaling stroke), and the head picker icons keep their size. A head now reaches up to
`old head height × HEAD_SCALE` above the chin, about 5 cm above the body's height line for
the bunny's ears, still inside the canvas's 6 cm top margin. The viewBox, the body and the
garments are unchanged (`skin.test.tsx`). At 390 px it stays clear of the stamp (≥ 71 px),
the picker (≥ 106 px) and the headline. The closest is the bunny's ears, 6 px under the
verdict line on a 196 cm body; the headline is in normal flow above the stage, so a longer
line pushes the stage down rather than overlapping it. It also stays inside the Discover
and Closet cards (screens: `head-scale-*.jpg`).

| Head  | Drawing |
|-------|---------|
| cloud | four overlapping `--surface` circles (a face circle and three puffs) with **one** ink outline round the group: the circles are drawn once with a 4.4 px ink stroke, then again filled on top, so only the outer edge shows (2.2 px). |
| peach | one `--brand` circle, a small leaf at the top (`--surface`, ink outline: no green, since green reads as a fit colour) and a soft crease line (ink at 35 %). |
| bunny | a `--surface` round head and two ears behind it, ears with `--brand` insides. |

Outlines are ink, 2.2 px, non-scaling (`vector-effect`), like the body.

## Face (`faceShape(tone, at)` in `heads.ts`)
The same face on every head, on the face circle: two eyes, two `--blush` cheeks, a small
mouth, ink lines 2 px. It follows a `FitTone`:

| Tone    | Eyes | Mouth |
|---------|------|-------|
| good    | happy closed (^ ^) | smile |
| warn    | dots | flat |
| bad     | dots | small frown |
| unknown | dots | flat |

- Fitting room: the selected size's existing verdict tone (`fittingHeadline(...).tone`,
  the same tone as the dot by the verdict line).
- Discover: the card's size's verdict tone (the tone the card already shows).
- Body screen and Closet: no fit is shown there, so `unknown` (neutral).
- From the back (the Front/Back toggle) there is no face, just the back of the head.

## Head picker (Fitting room)
Three 44 px round buttons stacked down the left edge of the stage, each showing a small
drawing of its head. `aria-label` "Cloud head" / "Peach head" / "Bunny head",
`aria-pressed` on the chosen one (ink fill when pressed; white with a 2 px ink ring when
not). Saved with `usePersistentState` under `choudo.head.v1` (guard `isHeadKind`). App
holds it and hands it down through a small context (`MascotHeadContext`), so every
Mannequin draws the chosen head without threading a prop through each screen.

## ちょうど stamp (`components/Stamp/`)
- A round double-ring seal in `--stamp`: a thick outer ring, a thin inner ring and ちょうど
  across the middle. The glyphs are outlined once from **Shippori Mincho B1 ExtraBold
  (800, SIL OFL)** by `app/scripts/stamp-glyphs.mjs` (opentype.js) into a committed path
  module, `Stamp/stampGlyphs.ts`, and a reference `Stamp/stamp.svg`. No Japanese font loads
  at runtime.
- Uneven ink: an SVG `feTurbulence` + `feDisplacementMap` filter roughens the edges, and a
  second noise pass knocks a few faint voids out of the ink.
- Rotated −9°, `mix-blend-mode: multiply`, 80 px, `role="img"`,
  `aria-label="ちょうど: just right"`.
- Top right of the stage, just outside the peach circle so it sits on `--bg` (stamp on
  `--bg` is ≥ 4.5:1; on `--peach-soft` it is not). The Save outfit button moves from that
  corner to the stage's bottom right.
- **Shows** only when the selected size is the suggested size **and** the headline says
  "{size} fits you": `isJustRight(odds, size, garment)` in `fitText.ts`, the same
  `confidentFit` rule `fittingHeadline` uses.
- **Animates once per garment + size per session** (`state/stampSeen.ts`, sessionStorage
  with an in-memory fallback): a 260 ms drop from scale 1.5 to 1 with a small rebound
  (1.5 → 0.94 → 1.03 → 1). Seen again in the same session, it is simply there.

## Hop
When a stamp drops, the whole figure (the Mannequin SVG) translates up 7 px and back over
380 ms, starting 140 ms in, as the seal first touches down. Web Animations API on the
figure (`ui/motion.ts`, keyframes are `translateY` only), so it doesn't restart the SVG
or its photos.

## Reduced motion
`prefers-reduced-motion: reduce`: the stamp fades in over 160 ms instead of dropping; no
hop.

## Testing
- `npm run check` and `npm run build` pass; golden files untouched.
- Head choice persists (`choudo.head.v1`), and the picker's `aria-pressed` follows it.
- Face per tone (pure `faceShape`, and the rendered `data-face`).
- Stamp only for recommended + fits (`isJustRight`, and the Fitting room: not for another
  size, not for "Your best bet").
- Stamp animates once per garment + size (`claimStampDrop`, and a second visit renders
  it static).
- Geometry identical across heads: the Mannequin markup outside the head group is the
  same for cloud, peach and bunny, for a bare body and a dressed one; hop keyframes
  translate only.
- 390 px screenshots in `2026-11-22-playful-reskin-screens/` (women's 165 cm / 70 kg, Lands'
  End surplice dress, "M fits you"): `mascot-cloud-stamp.jpg`, `mascot-peach-stamp.jpg`,
  `mascot-bunny-stamp.jpg` (M shown: stamp on, happy face) and `mascot-not-fitting.jpg`
  (XS shown, "Very likely too tight": no stamp, dot eyes and a frown).
