# Native app PR 5: Fitting room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The real Fitting room tab on the phone: browse Top / Bottom / Dress / Jacket, put garments on the mannequin, pick sizes, read the plain fit answer, open Fit details, see the ちょうど stamp drop, switch head / view / units, and save the outfit to the Closet.

**Architecture:** A port of `app/src/ui/screens/FittingRoom.tsx` and the components it uses (`FitAnswer`, `SizePicker`, `GarmentCarousel`, `GarmentIcon`, `GarmentBadge`, `FitSheet`, `FitReadout`, `TapeScale`, `Stamp`, `useStampDrop`, `motion.ts`, `NameForm`) plus the web `useCloset` hook. All state rules and wording already live in core (`resolveOutfit`, `wearGarment`, `defaultSize`, `garmentOdds`, `fitAllSizes`, `measurementHint`, `catalogueFor`, `catalogueToggle`, `emptyCategoryText`, `fittingHeadline`, `isJustRight`, `verdictLine`, `chipTone`, `stampKey`, `claimStampDrop`, `layerNoteLines`, `nextOutfitName`, closet functions). Fit details and Save outfit become native form-sheet routes, so Discover and the Closet can open the same sheet later.

**Tech Stack:** Expo SDK 58, Expo Router (form sheets), `react-native-svg`, Reanimated (stamp drop and hop), `expo-haptics`, `expo-web-browser` (the "View the chart" link), Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-11-23-native-iphone-app-design.md` (step 5).

## Global Constraints

- Wording, rules and numbers only from core; every visible string is copied from the web components named above. No new wording except where this plan gives it.
- Colours, type, radii from `@/theme`; layout values (stage 356 pt tall, 316 pt circle, 44 pt head and save buttons, stamp 80 pt at the stage's top right, gaps) from `FittingRoom.css`, `SizePicker`/carousel styles in `app/src/ui/styles.css` and `Stamp.css`. Fit colours only for fit results; ink for buttons and text.
- Storage only through `STORAGE_KEYS` and core guards (`outfit`, `catalogue`, `swipes`, `folders`, `outfits`, `head`); `EMPTY_OUTFIT` as the outfit fallback.
- `preference = preferenceSpec(anchor, fitStyle)`, memoised on both, as web `App.tsx`.
- The mannequin: `frame="body"`, `showHeightTape={false}`, `head`, `face` = `fittingHeadline(...).tone` of the active slot, `view` from the Front/Back control (not stored).
- Motion: the stamp drop (260 ms: opacity 0 → 1, rotate −9°, scale 1.5 → 0.94 → 1.03 → 1, as `Stamp.css`) and the figure's hop (translateY 0 → −7 → 0 pt, 380 ms, 140 ms delay, as `motion.ts`) with Reanimated; with Reduce Motion on (`useReducedMotion`), the stamp only fades in over 160 ms and there's no hop. The hop moves the figure's wrapper only, never scales it (skin rule).
- Haptics: `Haptics.selectionAsync()` when the size or garment changes from a tap; `Haptics.notificationAsync(Success)` when the stamp lands (at 55 % of the drop).
- The stamp is drawn without the web's ink-noise filter; rings and glyphs as `Stamp.tsx`, colour `colors.stamp`, `accessibilityLabel="ちょうど: just right"`.
- No path animation between sizes. Left for a later polish PR.
- Test mode's panel is not in this PR (PR 8).
- Root `npm run check` passes at every commit.

## Review Focus

1. First odds for a garment on the phone (500 samples, Hermes has no JIT). Task 6 adds a dev-only timing log; over 150 ms → the PR says so, and moving the sampling off the first frame is the next PR.
2. A stale stored outfit — `resolveOutfit` fixes it, the screen never throws. Pinned in Task 6.
3. Fit pins at the edge of the drawing — the stage lets the drawing overflow its view box. Pinned in Task 6.
4. A women's body on its own sizing with no dresses on show — the Dress tab hides, the Jacket tab's empty state offers Show all. Pinned in Task 6.
5. Saving an outfit with a blank name — `nextOutfitName(outfits)`; a 40+ character name is cut to `MAX_NAME_LENGTH`. Pinned in Task 5.

### Task 1: Stored state

`mobile/src/hooks/use-closet.ts` (+ test), `use-outfit.ts`, `use-catalogue.ts`, `use-preference.ts`. `useCloset()` is the web hook on `usePersistentState`. Test: blank-name save, deleteOutfit clears folders, unlike clears folders. Commit `Mobile: closet, outfit, catalogue and preference hooks`.

### Task 2: Garment card parts and size row

`garment-icon.tsx`, `garment-badge.tsx`, `fit-answer.tsx`, `size-picker.tsx`, `tape-scale.tsx` (+ tests for the size picker and icon). Size chips: `accessibilityRole="radio"`, label `"{size}, {tone name}{, suggested size}"`; `row` layout keeps the pick centred. Commit `Mobile: garment icon, badge, fit answer, size picker, tape scale`.

### Task 3: Garment carousel

`garment-carousel.tsx` (+ test): header count, previous/next, snapping `FlatList`, the settled card is selected. Commit `Mobile: garment carousel`.

### Task 4: Fit details sheet

`fit-readout.tsx`, `screens/fit-details`, route `app/fit-details.tsx` (form sheet, detents `[0.75, 1]`). `/fit-details?garmentId=&size=&from=fitting|browse`. Commit `Mobile: Fit details sheet`.

### Task 5: Stamp, hop and Save outfit

`components/stamp/` (`Stamp`, `useStampDrop`), `name-form.tsx`, route `app/save-outfit.tsx` (form sheet, `[0.35]`). Commit `Mobile: ちょうど stamp, hop and Save outfit`.

### Task 6: The Fitting room screen

`screens/fitting-room/` (`index.tsx`, `stage.tsx`, test); `app/(tabs)/index.tsx` renders it. Behaviour as web `FittingRoom`; stage `overflow: 'visible'`; dev-only `[odds] {id}: {ms} ms` log. Root `npm run check` and `npx expo export -p ios`. Update `CLAUDE.md`. Commit `Mobile: the Fitting room`. PR description lists Ryo's phone checks.
