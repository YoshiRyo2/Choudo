# Native app PR 2: Expo scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Expo app in `mobile/` that opens on an iPhone with Choudo's theme and font, native tabs (Fitting room / Discover / Closet), a first-run gate, and phone-native storage running the existing `choudo.*` migrations, importing the shared engine from `@choudo/core`.

**Architecture:** `mobile/` joins the root npm workspace next to `packages/core` and `app`. The whole workspace uses one React version (Expo SDK 58's exact one), so Metro never sees two copies. Screens in this PR are placeholders that prove the wiring; real screens start in PR 3.

**Tech Stack:** Expo SDK 58 (`expo@~58.0.26`, React Native 0.88.1, React 19.3.0), Expo Router (NativeTabs + Stack), `expo-sqlite/kv-store`, `@expo-google-fonts/m-plus-rounded-1c`, `jest-expo` + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-11-23-native-iphone-app-design.md` (step 2 of "Order of work").

## Global Constraints

- Install Expo packages with `npx expo install <pkg>` from `mobile/` so versions match SDK 58.
- One React for the whole workspace: `react` and `react-dom` pinned to exactly `19.3.0` in `app/package.json` and `mobile/package.json` (SDK 58's `bundledNativeModules.json` value). No `^`.
- Storage keys and migrations come from `@choudo/core/ui-logic/state/stored` and `.../migrate`; mobile defines no keys of its own.
- Guest only, nothing leaves the phone: no network calls, no analytics packages.
- App config: name `Choudo`, slug `choudo`, `ios.bundleIdentifier` `com.choudo.app`, `ios.supportsTablet: false`, `orientation: "portrait"`, `userInterfaceStyle: "light"`.
- Theme values copied from `app/src/ui/styles.css` `:root` (it is the source of truth, not the spec's older ink `#1b2433`): bg `#fff4ee`, surface `#ffffff`, ink `#2a2140`, muted `#6b5f73`, brand `#ffb59e`, peach-soft `#ffcfbd`, peach-tint `#ffe2d6`, line `#ffd6c7`, blush `#ff9c86`, stamp `#c8372d`, form `#fff7f2`, fit-good `#2b7353`, fit-warn `#a0571a`, fit-bad `#c2362f`. Radii 12 / 18 / 18 (card) / 28 (sheet) / 999 (pill). Type: headline 42/800, title 22/800, body 16/500, small 13/500. Colour roles as in that file's header comment.
- The website keeps working: root `npm run check`, `npm run build -w app` and `npm run dist:check -w app` pass at every commit.
- File names kebab-case; routes only in `mobile/src/app/`.

## Review Focus

1. Corrupt or old-format stored values (hand-edited JSON, a v1 key) — the app opens with defaults or migrated values, never crashes. Pinned in Task 2 and Task 3.
2. Storage unavailable or throwing — reads fall back, writes keep the in-memory value. Pinned in Task 2.
3. First launch with nothing stored — lands on the Body placeholder, not the tabs. Pinned in Task 5.
4. Two Reacts in the bundle after install — `npm ls react` shows a single `react@19.3.0`. Pinned in Task 1.
5. The website after the React pin — the Vite build and its 106 tests still pass, `dist:check` clean. Pinned in Task 1.

### Task 1: Workspace, one React, Expo app that bundles

**Files:**
- Modify: `package.json` (workspaces: add `"mobile"`), `app/package.json` (`react`, `react-dom` → `19.3.0`), `package-lock.json`
- Create: `mobile/` from `npx create-expo-app@latest mobile --template default@sdk-58`, then remove the template's example screens, components, hooks and assets except the icon placeholders; `mobile/package.json` name `@choudo/mobile`, scripts `start`, `ios`, `typecheck` (`tsc --noEmit`), `test` (`jest`), `check` (`npm run typecheck && npm test`); `@choudo/core: "*"` dependency
- Create: `mobile/app.json` with the Global Constraints config; `mobile/tsconfig.json` extending `expo/tsconfig.base` with `@/*` → `./src/*`
- Create: `mobile/src/app/index.tsx` (temporary: renders `SEED_GARMENTS.length` from `@choudo/core/domain/garments`)

**Interfaces:**
- Produces: workspace package `@choudo/mobile`; alias `@/*`; root `npm run check` now also runs mobile's `check`.

- [ ] **Step 1:** Scaffold, pin React in both apps, add `mobile` to workspaces, run `npm install` from the root.
- [ ] **Step 2:** Run `npm ls react react-dom` from the root. Expected: every entry is `19.3.0`, deduped, no `invalid`.
- [ ] **Step 3:** Run `cd mobile && npx expo-doctor`. Expected: all checks pass (a monorepo warning about duplicate native modules is a failure; fix it).
- [ ] **Step 4:** Run `cd mobile && npx expo export -p ios --output-dir /tmp/choudo-ios`. Expected: bundles with no resolution errors (proves Metro reaches `packages/core`).
- [ ] **Step 5:** Run root `npm run check`, `npm run build -w app`, `npm run dist:check -w app`. Expected: 1,045 core + 106 app tests pass, `data:check` 0 errors 1 warning, dist clean.
- [ ] **Step 6:** Commit `Mobile: Expo SDK 58 app in the workspace; one React (19.3.0)`.

### Task 2: Shared read/write helpers in core

**Files:**
- Create: `packages/core/ui-logic/state/persist.ts`, `packages/core/ui-logic/state/persist.test.ts`
- Modify: `app/src/ui/state/usePersistentState.ts` (use the helpers with `globalThis.localStorage`; behaviour unchanged)

**Interfaces:**
- Consumes: `StorageLike` from `./migrate`.
- Produces:
  - `readStored<T>(storage: StorageLike | null, key: string, fallback: T, isValid: (v: unknown) => v is T): T`
  - `writeStored(storage: StorageLike | null, key: string, next: unknown): void` — `null`/`undefined` removes the key, otherwise `JSON.stringify`; swallows throws.

- [ ] **Step 1:** Write the failing tests in `persist.test.ts`:
  - `readStored` returns the fallback for a missing key, for `'{not json'`, for a value failing `isValid`, for `storage === null`, and when `getItem` throws; returns the parsed value when valid.
  - `writeStored` stores `JSON.stringify(next)`, calls `removeItem` for `null` and `undefined`, and does not throw when `setItem` throws.
- [ ] **Step 2:** Run `npm test -w @choudo/core -- persist`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement both in `persist.ts`; rewrite the web hook's `read` and its `try` block to call them.
- [ ] **Step 4:** Run root `npm run check`. Expected: all pass, test count +the new tests.
- [ ] **Step 5:** Commit `Core: readStored / writeStored, shared by web and mobile`.

### Task 3: Native storage and migrations on launch

**Files:**
- Create: `mobile/src/storage/kv.ts`, `mobile/src/storage/kv.test.ts`
- Create: `mobile/src/hooks/use-persistent-state.ts`, `mobile/src/hooks/use-persistent-state.test.tsx`
- Create: `mobile/jest.config.js` (preset `jest-expo/ios`), `mobile/jest.setup.ts` (mock `expo-sqlite/kv-store` with an in-memory `Map` exposing `getItemSync`, `setItemSync`, `removeItemSync`)

**Interfaces:**
- Consumes: `readStored`, `writeStored` (Task 2); `migrateStorage(given?: StorageLike)`, `StorageLike`.
- Produces:
  - `kv: StorageLike` — wraps `expo-sqlite/kv-store`'s synchronous `getItemSync` / `setItemSync` / `removeItemSync` (confirm these names against the SDK 58 docs at `https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/`; if the sync API differs, adapt the wrapper, keep the `StorageLike` shape).
  - `runMigrations(): void` — calls `migrateStorage(kv)` once per process (module-level flag).
  - `usePersistentState<T>(key, fallback, isValid): [T, (next: T) => void]` — same signature and behaviour as the web hook, on `kv`.

- [ ] **Step 1:** Write the failing tests:
  - `kv.test.ts`: `kv.setItem('a','1')` then `kv.getItem('a') === '1'`; `removeItem` → `null`; `runMigrations()` on a store seeded with `nimbus.body.v2` moves it to `STORAGE_KEYS.body`, and a second call is a no-op.
  - `use-persistent-state.test.tsx` (RNTL `renderHook`): starts from a stored valid value; ignores an invalid stored value; the setter updates state and writes JSON; setting `null` removes the key.
- [ ] **Step 2:** Run `npm test -w @choudo/mobile`. Expected: FAIL.
- [ ] **Step 3:** Implement `kv.ts` and the hook.
- [ ] **Step 4:** Run `npm test -w @choudo/mobile` and `npm run typecheck -w @choudo/mobile`. Expected: PASS.
- [ ] **Step 5:** Commit `Mobile: native key-value storage and choudo.* migrations`.

### Task 4: Theme and font

**Files:**
- Create: `mobile/src/theme/colors.ts`, `typography.ts`, `radius.ts`, `spacing.ts`, `index.ts`; `mobile/src/components/themed-text.tsx`, `themed-text.test.tsx`
- Modify: `mobile/app.json` (add the `expo-font` config plugin with `@expo-google-fonts/m-plus-rounded-1c` weights 500, 700, 800)

**Interfaces:**
- Produces:
  - `colors` — exactly the Global Constraints hex values, keys camelCase (`peachSoft`, `fitGood`, …). Static fixed colours, no `Color.ios.*` (brand palette; light only).
  - `fonts = { medium: 'MPLUSRounded1c_500Medium', bold: 'MPLUSRounded1c_700Bold', extraBold: 'MPLUSRounded1c_800ExtraBold' }`
  - `type = { headline: {fontSize: 42, fontFamily: fonts.extraBold}, title: {22, extraBold}, body: {16, medium}, small: {13, medium} }`, colour `colors.ink`; line heights ≈ 1.45× for body/small, 1.1× for headline/title.
  - `radius = { s: 12, m: 18, card: 18, sheet: 28, pill: 999 }`; `spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }`
  - `<ThemedText variant?: keyof typeof type (default 'body') tone?: 'ink' | 'muted' (default 'ink') {...TextProps}>`

- [ ] **Step 1:** Write the failing test `themed-text.test.tsx`: default render has `fontFamily: 'MPLUSRounded1c_500Medium'`, `fontSize: 16`, `color: '#2a2140'`; `variant="headline"` → 42 / extraBold; `tone="muted"` → `#6b5f73`; a caller `style` merges last.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the theme files and component; `npx expo install expo-font @expo-google-fonts/m-plus-rounded-1c`.
- [ ] **Step 4:** Run `npm run check -w @choudo/mobile`. Expected: PASS.
- [ ] **Step 5:** Commit `Mobile: Choudo theme tokens and M PLUS Rounded 1c`.

### Task 5: Navigation, first-run gate, placeholders

**Files:**
- Create: `mobile/src/app/_layout.tsx` (root Stack: calls `runMigrations()` before first render, keeps the splash until fonts load, light status bar style on `colors.bg`)
- Create: `mobile/src/app/(tabs)/_layout.tsx` (NativeTabs), `(tabs)/index.tsx` (Fitting room), `(tabs)/discover.tsx`, `(tabs)/closet.tsx`
- Create: `mobile/src/app/body.tsx`, `mobile/src/app/fit-reference.tsx` (placeholders; real screens in PR 3)
- Create: `mobile/src/screens/placeholder.tsx` (title + one line of muted text on `colors.bg`)
- Create: `mobile/src/hooks/use-body.ts`, `mobile/src/app/gate.test.tsx`
- Delete: the temporary `mobile/src/app/index.tsx` from Task 1

**Interfaces:**
- Consumes: `usePersistentState`, `STORAGE_KEYS.body`, `isStoredBody`, `BodyInput`; `ThemedText`, `colors`.
- Produces:
  - `useBody(): [BodyInput | null, (b: BodyInput | null) => void]`
  - Routes: `/` (Fitting room tab), `/discover`, `/closet`, `/body`, `/fit-reference`.
  - Tabs, in order: `Fitting room` (SF `hanger`), `Discover` (SF `rectangle.stack`), `Closet` (SF `cabinet`); tint `colors.ink`. If an SF name doesn't render in the simulator, pick the nearest and note it in the PR.
  - Gate: the tabs layout redirects to `/body` when `useBody()[0]` is `null`.
  - The Fitting room placeholder shows "Fitting room", the stored body's height in cm, and the catalogue count from `catalogueFor`'s result for that body (proves the engine runs on the phone).

- [ ] **Step 1:** Write the failing test `gate.test.tsx` (expo-router's `renderRouter`): with empty storage, the initial route ends at `/body`; with a valid stored body, it ends at `/` and the "Fitting room" text is shown.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the layouts, routes and hook.
- [ ] **Step 4:** Run `npm run check -w @choudo/mobile` and `npx expo export -p ios`. Expected: PASS, bundles.
- [ ] **Step 5:** Commit `Mobile: native tabs, first-run gate, placeholder screens`.

### Task 6: CI, docs, hand-off check

**Files:**
- Modify: `.github/workflows/deploy-pages.yml` (no new steps needed if root `npm run check` covers mobile; confirm `npm ci --ignore-scripts` succeeds with mobile in the workspace, and add `npm run check -w @choudo/mobile` only if root check doesn't reach it)
- Modify: `CLAUDE.md` (Stack + Layout sections: `mobile/`, how to run it), `README.md` (run on iPhone: `cd mobile && npx expo start`, open in Expo Go)

- [ ] **Step 1:** From a clean clone: `npm ci --ignore-scripts && npm rebuild esbuild && npm run check && npm run build -w app && npm run dist:check -w app`. Expected: all pass.
- [ ] **Step 2:** `cd mobile && npx expo start` and confirm the dev server starts and prints a QR code (Ryo opens it in Expo Go on his iPhone; screenshots in the PR come from his phone or the simulator).
- [ ] **Step 3:** Commit `CI and docs for the mobile workspace`.
