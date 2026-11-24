# Native app PR 3: Body and Fit reference screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/body` and `/fit-reference` placeholders in `mobile/` with the real screens, so a first-time user can enter their body, optionally set a fit reference, and land in the tabs; and can come back to edit both.

**Architecture:** The screens are thin React Native views over logic that already lives in `packages/core` (`ui-logic/screens/bodyForm.ts`, `bodyFieldErrors.ts`, `bodyPreview.ts`, `anchorForm.ts`, `ui-logic/fitText.ts`). Behaviour, wording and validation copy the web screens (`app/src/ui/screens/BodyScreen.tsx`, `AnchorScreen.tsx`) exactly; only the controls become native. The mannequin preview on the Body screen is a reserved slot until PR 4.

**Tech Stack:** Expo SDK 58, Expo Router (Stack, form sheet), `@expo/ui` for the segmented controls if its universal `Picker` has a segmented style on SDK 58 (else `@react-native-segmented-control/segmented-control` via `npx expo install`), `react-native-svg` (installed now; PR 4 needs it too), RNTL.

**Spec:** `docs/superpowers/specs/2026-11-23-native-iphone-app-design.md` (step 3 of "Order of work"; "Body screen" bullet).

## Global Constraints

- All user-facing wording is copied verbatim from the web screens named above (labels, hints, errors, button text), except where this plan gives new text. Don't reword.
- Validation and parsing come only from core: `formToInput`, `fieldErrors`, `reveal`, `forgetIfFixed`, `shownErrors`, `braSizeProblemText`, `switchUnits`, `inputToForm`, `teeFormToAnchor`, `anchorToTeeForm`, `validateBodyInput`, `estimateBody`, `fitReferenceLine`, `FIT_STYLE_TEXT`. No new validation in `mobile/`.
- An error shows after its field loses focus, or for all fields after a submit; it hides as soon as the value is fixed (same rule as web).
- Number fields: `keyboardType="decimal-pad"` (core's `parseNumber` already accepts a comma); bra size: `autoCapitalize="characters"`, `autoCorrect={false}`.
- Touch targets ≥ 44 pt; every field has a visible label (or an accessibility label where the web hides it); errors are announced (`accessibilityLiveRegion="polite"` / `AccessibilityInfo.announceForAccessibility` on submit).
- Colours, type and radii only from `@/theme`; colour roles as in `app/src/ui/styles.css` (peach fills never as text colours; ink for text and the primary button).
- Test mode switch is dev-only: shown only when `__DEV__` (a preview-build variant comes in PR 8).
- Storage keys only from `STORAGE_KEYS`; guards `isStoredBody`, `isUnitSystem`, `isAnchor`, `isFitStyle`, `isBoolean`.
- Root `npm run check` passes at every commit.

## Review Focus

1. Keyboard covering the field being typed in, especially the tape-measure fields low on the screen — the focused field scrolls into view, and tapping a button while the keyboard is up works first time. Pinned in Task 3 (manual check listed in the PR) and `keyboardShouldPersistTaps="handled"` asserted in Task 3's test.
2. Switching units with values typed — numbers convert (core `switchUnits`), errors recompute, nothing is lost. Pinned in Task 3.
3. Leaving the first-run Fit reference by the iOS back swipe — treated as Skip: the body stays saved and the user lands in the tabs, not back on a blank Body screen. Pinned in Task 4.
4. Editing the body, then Cancel — nothing saved changes. Pinned in Task 3.
5. A stored anchor that names a garment no longer in the catalogue — the Fit reference opens on "choose" (or the measure step for a measured anchor) without crashing, and the Body screen's reference line falls back to `fitReferenceLine`'s own text. Pinned in Task 4.

### Task 1: Stored-state hooks and the Edit body entry point

**Files:**
- Create: `mobile/src/hooks/use-units.ts`, `use-fit-reference.ts`, `use-test-mode.ts`; `mobile/src/hooks/use-fit-reference.test.tsx`
- Modify: `mobile/src/app/(tabs)/index.tsx` (add an "Edit body" button under the placeholder text that pushes `/body`)

**Interfaces:**
- Consumes: `usePersistentState` (PR 2).
- Produces:
  - `useUnits(): [UnitSystem, (u: UnitSystem) => void]` — key `STORAGE_KEYS.units`, fallback `'metric'`.
  - `useFitReference(): { anchor: Anchor | null; style: FitStyle | null; set(anchor: Anchor | null, style: FitStyle | null): void; clear(): void }` — keys `anchor`, `fitStyle`; `set` with a style and `null` anchor clears the anchor (web rule: picking a style clears the anchor).
  - `useTestMode(): [boolean, (on: boolean) => void]` — key `testMode`, fallback `false`.

- [ ] **Step 1:** Write the failing test `use-fit-reference.test.tsx`: `set(null, 'relaxed')` after a catalogue anchor leaves `anchor === null`, `style === 'relaxed'`, and both keys stored; `clear()` removes both keys; an invalid stored anchor reads as `null`.
- [ ] **Step 2:** Run `npm test -w @choudo/mobile -- use-fit-reference`. Expected: FAIL.
- [ ] **Step 3:** Implement the three hooks and the Edit body button.
- [ ] **Step 4:** Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] **Step 5:** Commit `Mobile: units, fit-reference and test-mode hooks; Edit body button`.

### Task 2: Form controls

**Files:**
- Create: `mobile/src/components/number-field.tsx`, `segmented.tsx`, `button.tsx`, `field-error.tsx`, `wordmark.tsx`, and `number-field.test.tsx`
- Add asset: `mobile/assets/images/wordmark-icon.png` (copy of `app/public/icon-192.png`)

**Interfaces:**
- Produces:
  - `<NumberField label hint? unit value onChangeText onBlur? invalid? errorId? placeholder? showLabel? autoFocus?>` — a `TextInput` (decimal pad) with the unit as a suffix, label above when `showLabel` (else `accessibilityLabel`), hint under the label in muted, a `colors.ink` 50% field edge (3:1, as web's `--field-edge`), `colors.fitBad` edge when `invalid`.
  - `<FieldError message?>` — renders nothing without a message; text in `colors.fitBad`, `accessibilityLiveRegion="polite"`.
  - `<Segmented<T extends string> label value options={{value: T; label: string}[]} onChange>` — native segmented control (see Tech Stack), label shown above.
  - `<Button variant: 'primary' | 'outline' | 'quiet' size?: 'md' | 'sm' title onPress disabled?>` — primary = ink fill, white text; outline = ink border; quiet = text only; pressed opacity 0.7; min height 44.
  - `<Wordmark>` — the icon (28 pt) and "Choudo" in `type.title`.

- [ ] **Step 1:** Write the failing test `number-field.test.tsx`: renders the label and unit; `onChangeText` receives typed text; `keyboardType` is `decimal-pad`; with `invalid` the field has `accessibilityState`/`aria-invalid` true; `FieldError` with a message is found by text, without one renders null.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the components (`npx expo install react-native-svg` now as well; Task 4 uses it).
- [ ] **Step 4:** Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] **Step 5:** Commit `Mobile: number field, segmented control, buttons, wordmark`.

### Task 3: Body screen

**Files:**
- Create: `mobile/src/screens/body/index.tsx` (the screen), `mobile/src/screens/body/estimate-list.tsx`, `mobile/src/screens/body/body-screen.test.tsx` (route-rendering tests go in `mobile/src/tests/` if they use `renderRouter`)
- Modify: `mobile/src/app/body.tsx` (renders the screen; reads `useBody`, `useUnits`, `useFitReference`, `useTestMode`)
- Create: `mobile/src/app/about.tsx` (form sheet: `presentation: 'formSheet'`, grabber, detents `[0.6, 1]`), registered in the root `_layout.tsx`

**Interfaces:**
- Consumes: Task 1 hooks, Task 2 components, core functions in Global Constraints.
- Produces: `<BodyScreen initial: BodyInput | null; units: UnitSystem; onDone(input, units): void; onCancel?(): void; fitReference?: { line: string; isSet: boolean; onChange(input: BodyInput | null, units): void; onRemove(): void }; testMode?: { on: boolean; onChange(on: boolean): void }>` — same props and behaviour as the web `BodyScreen`.

Layout, top to bottom, in a `ScrollView` (`keyboardShouldPersistTaps="handled"`, `automaticallyAdjustKeyboardInsets`): wordmark; "Your measurements" (`type.title`) and the lede; Units segmented (`cm, kg` / `ft, lb`); "Size me in" segmented; Height (cm, or ft + in side by side); Weight; the collapsible "Have a tape measure? Add your own numbers" section (chest/bust, waist, hips, inseam with estimate placeholders; bra size + US/UK for a women's body); the fit-reference card (edit only); the primary button; Cancel (edit only); the "Enter your height and weight to continue." alert after a failed submit; the privacy line with an "About Choudo" link that pushes `/about`; the dev-only Test mode switch (`Switch`).

Preview: a reserved, fixed-height box (`colors.peachTint`, `radius.card`) with `testID="mannequin-slot"` above the estimate list; PR 4 puts the mannequin there. The estimate list shows when the body is valid, else the caption "Enter your height and weight to size it to you."

Route wiring in `app/body.tsx`: first run → on done save body + units; if no anchor and no style, `router.replace('/fit-reference?first=1')`, else `router.replace('/')`. Edit (a body exists) → on done save, `router.back()`; Cancel → `router.back()` with nothing saved; "Change"/"Add a tee you like" → save the form's body if valid, then `router.push('/fit-reference')`.

About text: the web `AboutSheet` text, except the data paragraph reads "There’s no account and nothing is uploaded: your body, likes, folders and outfits are saved on this phone only. Deleting the app removes them."

- [ ] **Step 1:** Write the failing tests `body-screen.test.tsx`:
  - empty form: pressing the primary button shows "Enter your height and weight to continue." and calls no `onDone`;
  - typing 170 cm / 65 kg and pressing it calls `onDone` with `heightCm: 170`, `weightKg: 65` and `'metric'`;
  - typing height 300 and blurring shows the core error text for height (`fieldErrors` result), and typing 170 hides it;
  - switching Units to `ft, lb` with 170 / 65 typed shows the converted values from `switchUnits`;
  - choosing Women’s clothes and opening the tape section shows "Full bust" and the "Bra size" field; men's shows "Chest" and no bra field;
  - with `onCancel` given, Cancel calls it and not `onDone`;
  - the Test mode switch is absent when `testMode` is undefined;
  - the `ScrollView` has `keyboardShouldPersistTaps="handled"`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the screen, the route wiring and the About sheet.
- [ ] **Step 4:** Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] **Step 5:** Commit `Mobile: Body screen and About sheet`.

### Task 4: Fit reference screen

**Files:**
- Create: `mobile/src/screens/fit-reference/index.tsx` (step switcher), `choose-step.tsx`, `catalogue-step.tsx`, `measure-step.tsx`, `style-step.tsx`, `tee-diagram.tsx`, and `fit-reference.test.tsx`
- Modify: `mobile/src/app/fit-reference.tsx`; `mobile/src/tests/gate.test.tsx` (add the first-run flow)

**Interfaces:**
- Consumes: `useFitReference`, `useUnits`; core `canAnchor`, `FIT_STYLES`, `GARMENTS`, `FIT_STYLE_TEXT`, `teeFormToAnchor`, `anchorToTeeForm`.
- Produces: `<FitReferenceScreen units anchor style onDone(anchor: Anchor | null, style: FitStyle | null) onSkip skipLabel>` — the web `AnchorScreen`'s steps (`choose` / `catalogue` / `measure` / `style`), opening on the step that matches the stored reference, headings and hints verbatim.

Catalogue rows: brand and name only, plus a small swatch in the garment's colour; the garment pictures arrive with the shared garment icon in PR 5. Size pills: round, `radius.pill`, selected = ink fill.

`TeeDiagram`: the web SVG (`AnchorScreen.tsx` path, `AnchorScreen.css` colours) in `react-native-svg`, 108 pt wide: tee `colors.surface` fill with a 1.5 `colors.ink` stroke, tape lines `colors.brand` 4 wide with round caps, labels "chest" / "length" 10 pt in the medium font.

Route wiring: `?first=1` → skip label "Skip for now", done or skip → `router.replace('/')`; otherwise "Cancel", done or skip → `router.back()`. With `first=1`, set `gestureEnabled: false` on the screen so a back swipe can't return to a blank Body screen.

- [ ] **Step 1:** Write the failing tests `fit-reference.test.tsx`:
  - opens on "Got a tee that fits the way you like?" with no reference; on "Which tee, and what size?" for a catalogue anchor; on "Measure your tee" for a measured anchor;
  - catalogue: Save is disabled until a size is picked; picking a garment and size calls `onDone({kind:'catalogue', garmentId, size}, style)`;
  - measure: empty Save shows "Enter both numbers to continue."; valid numbers call `onDone` with `teeFormToAnchor`'s anchor;
  - style: picking one calls `onDone(null, style)`;
  - a catalogue anchor whose `garmentId` isn't in `GARMENTS` renders without throwing;
  - and in `gate.test.tsx`: empty storage → `/body` → fill 170/65 → Go to fitting room → `/fit-reference` → Skip for now → `/` with the body stored.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the steps, the diagram and the route wiring.
- [ ] **Step 4:** Run `npm run check -w @choudo/mobile`, then root `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `Mobile: Fit reference screen`.

### Task 5: Docs and phone check

**Files:**
- Modify: `CLAUDE.md` (a `mobile/` entry under Layout listing `screens/body`, `screens/fit-reference`, `components/`, `hooks/`)

- [ ] **Step 1:** `cd mobile && npx expo export -p ios`. Expected: bundles.
- [ ] **Step 2:** In the PR description, list the phone checks for Ryo (Expo Go, `npx expo start --tunnel` on campus Wi-Fi): first run end to end; the keyboard never hides the field being typed; tab icons now visible (hanger, stacked cards, cabinet); Edit body → Cancel changes nothing; About opens as a sheet.
- [ ] **Step 3:** Commit `Docs: mobile screens in CLAUDE.md`.
