# Shared core package (native app PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the fit engine and the pure UI helpers out of `app/` into a shared
`packages/core` that the Vite app imports, with no change in behaviour.

**Architecture:** An npm workspace at the repo root holds `packages/core` (`@choudo/core`)
and `app`. Core ships TypeScript source; there's no build step. Its `package.json` has no
`exports`, so `@choudo/core/domain/fit` resolves to `packages/core/domain/fit/index.ts` in
TypeScript (bundler resolution), Vite and, later, Metro. `app/src/domain` becomes
`packages/core/domain`. The pure helpers in `app/src/ui` move to `packages/core/ui-logic`
**at the same relative paths** (`ui/state/stored.ts` becomes `ui-logic/state/stored.ts`).
Since `ui-logic/` sits next to `domain/` exactly as `ui/` did, every relative import
between moved files stays valid, and the move is pure `git mv` with history kept.
Renaming folders inside core is left for later.

**Tech Stack:** npm 11 workspaces, TypeScript 5.9, Vite 8, Vitest 5, Node 24.

**Spec:** `docs/superpowers/specs/2026-11-23-native-iphone-app-design.md` (sections
"Repo layout" and "Order of work" step 1).

## Global Constraints

- "No behaviour change." The built site, the fit results and the stored data are the same
  before and after.
- `domain/fit/golden.test.ts` and `__golden__/` are unchanged byte for byte and keep
  passing: git must show them as 100 % renames.
- `packages/core` is "shared, no React DOM, no React Native". Core's tsconfig has **no DOM
  lib** and no `types`, so a browser global in core is a type error.
- `npm run check` must pass before every commit (CLAUDE.md). After Task 1 that means the
  root `npm run check`, which runs core and app.
- Dependency versions stay exactly as in today's `app/package-lock.json`.
- The live site keeps working, unchanged. The `deploy-pages.yml` output is still
  `app/dist` at base `/Choudo/`.

## Review Focus

1. **Core tests silently left out of the gate.** After the move, `app`'s own
   `npm run check` no longer runs the engine or golden tests. The root check and CI must
   run them. Pinned by the test-count check in Tasks 1–3: core + app = baseline total.
2. **The built site changes.** This includes local-only photos (the Gildan 5000 cut-out)
   leaking into `dist/`. Pinned in Task 3 by `dist:check` plus a byte comparison of
   `dist/` against a baseline build.
3. **Dependency drift from moving the lockfile.** Pinned in Task 1 by comparing every
   package version in the new root lock with the old app lock.
4. **The dev server can't serve core files, or the landmark picker's save route can't
   load its modules.** Pinned in Task 3 by loading the app in the dev server and POSTing
   to `/__dev/landmarks`.
5. **A clean CI install fails** (workspaces plus `npm ci --ignore-scripts` from the root).
   Pinned in Task 3 by running the workflow's commands from a fresh `node_modules`.

---

### Task 1: Workspace, and `domain/` moved into `packages/core`

**Files:**
- Create: `package.json` (repo root), `packages/core/package.json`,
  `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Move: `app/package-lock.json` → `package-lock.json`; `app/src/domain/` →
  `packages/core/domain/` (whole folder, including `__golden__/` and `seed.json`)
- Modify: `app/package.json` (dependency on core), every staying file in `app/src` that
  imports `domain/` (rewritten by script), `app/build/leaveOutLocalPhotos.ts`,
  `app/dev/landmarksServer.ts`, `app/scripts/data-check.mjs`, `dist-check.mjs`,
  `fit-report.mjs`, `garment-photos.mjs`
- Test: the moved domain tests (unchanged) and all app tests

**Interfaces:**
- Produces: package `@choudo/core` at `packages/core`. Import specifiers have the form
  `@choudo/core/domain/<path>`, extensionless, the same as the old relative path after
  `domain/`.
- Produces: the root scripts `check` (= `npm run check --workspaces`) and `test`
  (= `npm test --workspaces`).
- Produces: `<scratch>/rewrite-core-imports.mjs` (not committed), rerun in Task 2.

- [ ] **Step 1: Record the baseline**

From `app/`: `npm ci`, then `npx vitest run`. Write down the totals for test files and
tests (call them F₀ and T₀). Then `npm run build` and copy `app/dist` to
`<scratch>/dist-before` for Task 3. Measured on `main` at `1fbfc43`: the files that move
in Tasks 1–2 come to 68 test files and 1,045 tests.

- [ ] **Step 2: Create the workspace**

Root `package.json`: `"name": "choudo"`, `"private": true`,
`"workspaces": ["packages/core", "app"]`, and the scripts `check` and `test` above.
`packages/core/package.json`: `"name": "@choudo/core"`, `"version": "0.0.0"`,
`"private": true`, `"type": "module"`, no `exports`, and the scripts
`"typecheck": "tsc -p tsconfig.json"`, `"test": "vitest run"`,
`"check": "npm run typecheck && npm test"`. Its devDependencies are `typescript` and
`vitest` with the same ranges as `app/package.json` (`^5.9.3`, `^5.1.1`).
`packages/core/tsconfig.json`: the compiler options of `app/tsconfig.app.json`, except
`"lib": ["ES2022"]`, `"types": []`, no `jsx`, no `tsBuildInfoFile`, and
`"include": ["domain"]` (Task 2 adds `"ui-logic"`).
`packages/core/vitest.config.ts`: `include: ['**/*.test.ts']`,
`exclude: ['node_modules/**']`, `environment: 'node'`.
In `app/package.json` dependencies, add `"@choudo/core": "*"`.

- [ ] **Step 3: Move the lockfile and install**

`git mv app/package-lock.json package-lock.json`, delete `app/node_modules`, then run
`npm install` at the root. The hoisted keys (`node_modules/<name>`) are the same in a
workspace lock, so npm keeps the locked versions.

- [ ] **Step 4: Check that no dependency version moved**

Write a throwaway node script. For every key starting with `node_modules/` in
`git show HEAD:app/package-lock.json`'s `packages`, print the key if the new
`package-lock.json` has that key with a different `version`. Ignore keys that are new to
the root lock (the workspace links).
Expected: no output. If anything prints, stop and report it. Don't continue on a drifted
lock.

- [ ] **Step 5: Move `domain/`**

`git mv app/src/domain packages/core/domain`.

- [ ] **Step 6: Run the app type-check to see it fail**

Run: `npm run typecheck -w app`
Expected: FAIL, with "Cannot find module '…/domain/…'" errors across most of
`app/src` (the UI helpers that move in Task 2 still import `domain/` here too).

- [ ] **Step 7: Write and run `<scratch>/rewrite-core-imports.mjs`**

Arguments: the app `src` dir and the core dir. For every `.ts`/`.tsx` file under
`app/src`, and every relative specifier in `from '…'`, `import('…')` and
`import '…'`:
- Resolve the specifier against the file's folder **as `app/src` was before the move**,
  and strip any `?query` first, keeping it to add back.
- If the result is under `src/domain/`, replace the specifier with `@choudo/core/domain/`
  plus the rest of the path.
- If the result is under `src/ui/` and the same relative path exists under
  `<core>/ui-logic/` (try `''`, `.ts`, `/index.ts`, `.json`, `.svg`), replace it with
  `@choudo/core/ui-logic/` plus that path.
- Keep the specifier's own extension and query as written. For example
  `'../../domain/garments/seed.json?raw'` becomes
  `'@choudo/core/domain/garments/seed.json?raw'`.

Leave every other specifier alone. Print the count of rewrites per file.

- [ ] **Step 8: Repoint the tooling files by hand (relative paths, not the package
  name)**

Vite bundles `vite.config.ts` and its relative imports, but loads bare package imports
through Node, which can't load core's extensionless TypeScript. So `build/` and `dev/`
reach core by relative path:
- `app/build/leaveOutLocalPhotos.ts`: import from
  `'../../packages/core/domain/garments/photo.ts'` and `…/types.ts`.
  `SEED = '../packages/core/domain/garments/seed.json'` (resolved against `config.root`,
  which is `app/`).
- `app/dev/landmarksServer.ts`: change its `import type`s and `typeof import(…)`s to
  `'../../packages/core/domain/garments/…'`, and `SEED` as above. Change
  `ssrLoadModule('/src/domain/garments/validate.ts')` to
  `ssrLoadModule(join(root, '../packages/core/domain/garments/validate.ts'))`.
  `'/src/dev/landmarks/seedWrite.ts'` stays as it is.
- `app/scripts/data-check.mjs`, `dist-check.mjs` and `fit-report.mjs`: change each
  `load('src/domain/…')` to `load('../packages/core/domain/…')`, and the matching
  comments.
- `app/scripts/garment-photos.mjs`: the seed path becomes
  `join(APP, '../packages/core/domain/garments/seed.json')`.

- [ ] **Step 9: Run the full check to see it pass**

Run: `npm run check` (root).
Expected: core typecheck clean, core Vitest green, app `tsc -b` clean, app Vitest green,
`data:check` prints its report with 0 errors. Then
`grep -rnE "['\"](\.\./)+domain/" app/src app/build app/dev` gives no output, and
`git status` shows `packages/core/domain/fit/golden.test.ts` and `__golden__/*` as
renames with no content change (`git diff --cached -M --stat` shows `=>` and 0 changed
lines for them).

- [ ] **Step 10: Check the test count**

Core files + app files must equal F₀, and core tests + app tests must equal T₀ (from the
two Vitest summaries in Step 9).

- [ ] **Step 11: Commit**

```bash
git add -A package.json package-lock.json packages app
git commit -m "Move the fit engine into packages/core (npm workspace); app imports @choudo/core"
```

---

### Task 2: Pure UI helpers moved into `packages/core/ui-logic`, DOM-free

**Files:**
- Move (`git mv`, keeping paths relative to `app/src/ui/` → `packages/core/ui-logic/`,
  each with its `.test.ts` where one exists):
  - `components/Mannequin/`: `geometry.ts`, `topShape.ts`, `photoWarp.ts`, `heads.ts`,
    `view.ts`, `pantsFixture.ts`, all of `templates/` (with its `__snapshots__/`), and
    `__snapshots__/` (the three `tee-warp-*.json`, used only by `photoWarp.test.ts`)
  - `components/SwipeCard/swipe.ts`; `components/Stamp/stampGlyphs.ts` and
    `components/Stamp/stamp.svg`; `components/garmentThumb.ts`; `components/sizeRow.ts`
  - `fitText.ts`, `catalogueText.ts`, `leggingsText.test.ts` (it tests `fitText`)
  - `state/`: `closet`, `feed`, `outfit`, `odds`, `fitTests`, `stampSeen`, `stored`,
    `migrate`
  - `screens/`: `bodyForm`, `bodyFieldErrors`, `bodyPreview`, `anchorForm`
- Stay in `app/src/ui`: all `.tsx` and `.css`, plus `devTools.ts` (Vite's
  `import.meta.env`), `motion.ts` and `focus.ts` (DOM), `registerServiceWorker.ts`,
  `usePhotoSize.ts`, `useStampDrop.ts`, `useCloset.ts`, `usePersistentState.ts`,
  `test/dom.ts`
- Modify: `packages/core/tsconfig.json` (`include` adds `"ui-logic"`),
  `packages/core/ui-logic/state/migrate.ts`, `packages/core/ui-logic/state/stampSeen.ts`,
  `app/scripts/stamp-glyphs.mjs`, and the staying app files that import moved helpers
  (rewritten by script)

**Interfaces:**
- Consumes: `@choudo/core` and `rewrite-core-imports.mjs` from Task 1.
- Produces: `@choudo/core/ui-logic/<old path under ui/>`, for example
  `@choudo/core/ui-logic/state/stored` and
  `@choudo/core/ui-logic/components/Mannequin/geometry`. These exports keep their names
  and signatures, with two type changes:
  - `StorageLike` (in `state/migrate.ts`) =
    `{ getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }`
  - `SessionStore` (in `state/stampSeen.ts`) =
    `{ getItem(key: string): string | null; setItem(key: string, value: string): void }`

  The Expo storage adapter in PR 2 implements `StorageLike`.

- [ ] **Step 1: Move the files and widen core's tsconfig**

Do the `git mv`s listed above, then add `"ui-logic"` to `packages/core/tsconfig.json`'s
`include`.

- [ ] **Step 2: Run the core type-check to see it fail**

Run: `npm run typecheck -w @choudo/core`
Expected: FAIL with exactly 12 errors, all in `state/migrate.ts`, `state/stampSeen.ts`
and their two tests: `TS2304: Cannot find name 'Storage'`, `TS7017` on
`globalThis.localStorage`, `TS2552: Cannot find name 'sessionStorage'`, and `TS7006` on
the test fakes' parameters. Any other error means something with a DOM dependency moved,
so put it back in the app.

- [ ] **Step 3: Make the two files DOM-free without changing what they do**

- `migrate.ts`: `StorageLike` becomes the structural type above. In `migrateStorage`, the
  fallback becomes
  `given ?? (globalThis as { localStorage?: StorageLike }).localStorage`, still inside
  the existing `try`, because Safari throws on access when storage is blocked.
- `stampSeen.ts`: `SessionStore` becomes the structural type above. `sessionStore()`
  returns `(globalThis as { sessionStorage?: SessionStore }).sessionStorage ?? null`,
  inside its existing `try`.

Update the doc comments to say "the bits of Web Storage we use".

- [ ] **Step 4: Rerun the import rewrite and repoint the glyph script**

Run `<scratch>/rewrite-core-imports.mjs` again on `app/src`. In
`app/scripts/stamp-glyphs.mjs`, change `OUT_DIR` to
`new URL('../../packages/core/ui-logic/components/Stamp/', import.meta.url)` and update
the header comment's paths.

- [ ] **Step 5: Run the full check to see it pass**

Run: `npm run check` (root).
Expected: everything green, as in Task 1 Step 9. Core now has 68 test files and 1,045
tests (more if `main` gained tests since `1fbfc43`), and core + app still equal F₀ / T₀.
`grep -rnE "from '(\.\./)+(state|components/Mannequin/(geometry|topShape|photoWarp|heads|view)|fitText|catalogueText)'" app/src`
gives no output.

- [ ] **Step 6: Commit**

```bash
git add -A packages app
git commit -m "Move pure UI helpers into packages/core/ui-logic; drop their DOM types"
```

---

### Task 3: CI, docs, and proof that nothing changed

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`, `CLAUDE.md` (Layout and Commands),
  `README.md` (lines 90–96, the code map)

**Interfaces:**
- Consumes: the root scripts from Task 1, and `<scratch>/dist-before` from Task 1 Step 1.

- [ ] **Step 1: Update the workflow**

In the `build` job, drop `defaults.run.working-directory`, and set
`cache-dependency-path: package-lock.json`. Steps in order:
`npm ci --ignore-scripts`, `npm rebuild esbuild`, `npm run check`,
`npm run build -w app`, `npm run dist:check -w app`. `upload-pages-artifact` keeps
`path: app/dist`. Update the header comment ("Builds app/ …") to match.

- [ ] **Step 2: Run the workflow's commands from a clean install**

Delete every `node_modules` (root, `app/` and `packages/core/`), then from the root run
the five commands in Step 1 in order.
Expected: each exits 0, and `dist:check` reports no local-only files in `dist/`.

- [ ] **Step 3: Compare the build with the baseline**

Run: `diff -r <scratch>/dist-before app/dist`
Expected: no output. If a file differs, run both through `npx prettier` and diff again.
Only module-order or hash differences with identical code are acceptable, and you must
name them in the PR description. Anything else is a behaviour change: stop.

- [ ] **Step 4: Smoke-test the dev server**

Start the dev server with the existing `choudo-app` entry in `.claude/launch.json`
(`npm --prefix app run dev`, port 5173; it needs no change). Load `/`, go through Body → Fitting
room, and confirm the mannequin draws and the console has no errors or 403s for
`/@fs/…/packages/core/…`. Then run
`curl -s -X POST localhost:5173/__dev/landmarks -H 'content-type: application/json' -d '{"id":"no-such-garment","file":"x.png","landmarks":{}}'`.
Expected: `{"error":"No garment \"no-such-garment\" in seed.json"}`. This loads both
`ssrLoadModule` paths and writes nothing; a 500 means a path is wrong.

- [ ] **Step 5: Update the docs**

- `CLAUDE.md` Layout block: show `packages/core/{domain,ui-logic}` and `app/src/ui`
  (React only). Change the rule to "body estimation, the fit engine, garment data and
  pure UI logic live in `packages/core`, which never imports React, the DOM or
  `app/`". The seed path becomes `packages/core/domain/garments/seed.json`.
- Commands: `npm install` and `npm run check` run from the repo root; `dev`, `build`,
  `test` and the data scripts run from `app/` as before; core alone is
  `npm test -w @choudo/core`.
- Remove the `src/, tests/, data/` Python line and the `python -m …` commands. Main
  deleted the Python reference in `1fbfc43`, so they're wrong now. Do the same in
  README lines 90–96.

- [ ] **Step 6: Run the check and commit**

Run: `npm run check` (root). Expected: exit 0.

```bash
git add -A .github CLAUDE.md README.md
git commit -m "CI and docs for the packages/core workspace"
```
