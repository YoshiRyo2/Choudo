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
