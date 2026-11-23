# GitHub Pages PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every push to `main` builds `app/` in GitHub Actions and deploys it to GitHub Pages as an installable PWA. Photos without warp rights, dev tools and Test mode stay out of that build.

**Architecture:** Vite builds with `base: '/Choudo/'`, and the manifest uses relative URLs so dev (`/`) and Pages (`/Choudo/`) share one file. A hand-written `public/sw.js` makes the app work offline. Photo rights are data: `image.licence` in `seed.json`, checked by `npm run data:check`. The mannequin warps only `own` and `brand-permission` photos, and a build-only Vite plugin deletes `local-only` files from `dist/`. A `dist:check` script then confirms the output before it's uploaded.

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest 5, GitHub Actions (`actions/configure-pages`, `upload-pages-artifact`, `deploy-pages`).

**Spec:** The user's request in this session (quoted in the PR description), with its 19 Nov correction to the licence bullet.

## Global Constraints

- Repo is `YoshiRyo2/Choudo` (public), so the base is `/Choudo/` and the live URL is `https://yoshiryo2.github.io/Choudo/`.
- Licence values, exactly: `own` / `brand-permission` / `affiliate-unaltered` / `local-only`. A missing or unknown licence is a `data:check` error.
- Only `own` and `brand-permission` photos are warped onto the mannequin. Every other garment draws in its flat colour.
- `local-only` photo files never ship in the production build.
- Seed licences: `gildan-5000` → `local-only` (Gildan's product image, no permission). `ryo-navy-graphic-tee` → `local-only` (trademark logo). `ryo-grey-polo`, `ryo-cream-boxy-tee` and `ryo-black-henley` → `own`.
- The landmark picker (`/dev/landmarks`) and Test mode are absent from the production build.
- About page: what Choudo is, that data stays on this device, and a placeholder line for the affiliate disclosure.
- CI install: `npm ci --ignore-scripts`, then `npm rebuild esbuild`. esbuild isn't installed under Vite 8, so the second command is a no-op kept as asked. `--ignore-scripts` skips onnxruntime-node's binary download, which only `npm run photos` needs.
- No new npm dependencies. `npm run check` passes before every commit (CLAUDE.md).
- GitHub settings (turning Pages on, choosing "GitHub Actions" as its source, Actions permissions) change only after the user says yes.

## Review Focus

1. **An asset under the base path:** a returning phone loads `/Choudo/`, and every icon, the manifest, the fonts and the garment photos resolve under `/Choudo/`, not `/`. Pinned by `dist:check` (Task 6) reading `dist/index.html` and the manifest.
2. **A phone with `choudo.testMode.v1 = true` already stored:** production still shows no Test mode switch and no Test panel. Pinned by `devToolsOn(stored, dev)` tests (Task 3).
3. **Saving landmarks in the picker:** saving must keep the photo's licence, and a brand-new photo gets `local-only` so it can't ship by accident. Pinned by `seedWrite` tests (Task 1).
4. **A photo that's git-ignored but marked `own`:** CI wouldn't have the file, and the garment would silently lose its photo. `data:check` error (Task 1).
5. **A new deploy while the app is installed:** the app must pick up the new version, not serve a stale shell forever. `sw.js` fetches pages network-first. Checked by hand in Task 4 (reload after a rebuild).

---

### Task 1: Photo licence in the data, and data:check

**Files:**
- Modify: `app/src/domain/garments/types.ts` (`GarmentImage`)
- Create: `app/src/domain/garments/photo.ts`, `app/src/domain/garments/photo.test.ts`
- Modify: `app/src/domain/garments/validate.ts` (`validateImage`), `garments.test.ts` (fixtures get a licence)
- Modify: `app/src/domain/garments/report.ts`, `report.test.ts`, `app/scripts/data-check.mjs`
- Modify: `app/src/domain/garments/seed.json` (5 images), the domain `index.ts` exports
- Modify: `app/src/dev/landmarks/seedWrite.ts` + test, `LandmarkPicker.tsx` (keep licence)
- Modify: `docs/adding-garments.md`, `CLAUDE.md` (Images rule)

**Interfaces:**
- Produces: `PHOTO_LICENCES = ['own', 'brand-permission', 'affiliate-unaltered', 'local-only'] as const` and `type PhotoLicence` in `types.ts`, plus `GarmentImage.licence: PhotoLicence`.
- Produces in `photo.ts`: `canWarp(image: GarmentImage | undefined): boolean` (true only for `own` / `brand-permission`) and `localOnlyFiles(garments: readonly { image?: GarmentImage }[]): string[]` (unique `image.file` values whose licence is `local-only`).
- Changes `ImageFileInfo` from `{ width, localOnly }` to `{ width: number | null; gitIgnored: boolean }`. `data-check.mjs` fills `gitIgnored` from `git check-ignore`, as today.

- [ ] **Step 1: Write failing tests**
  - `photo.test.ts`: `canWarp` is true for `own` and `brand-permission`, and false for `affiliate-unaltered`, `local-only` and `undefined`. `localOnlyFiles` returns `['garments/a.png']` for two garments sharing a local-only file plus one `own`.
  - `garments.test.ts`: `validateSeed` on a photo with no `licence` reports `image: licence must be one of own, brand-permission, affiliate-unaltered, local-only`, and likewise for `licence: 'mine'`.
  - `report.test.ts`:
    - A `local-only` image with `{ width: null, gitIgnored: true }` → state `local-only`, 0 errors.
    - A `local-only` image that's committed and 900 px → state `local-only`, 0 errors.
    - An `own` image with `{ width: 900, gitIgnored: true }` → 1 error matching `/git-ignored.*local-only/`.
    - The missing and too-small cases stay as they are.
  - `seedWrite.test.ts`: rewriting an existing image keeps `"licence": "own"`, and the output contains a `"licence"` line.
- [ ] **Step 2:** `npx vitest run src/domain/garments src/dev` → the new tests FAIL.
- [ ] **Step 3: Implement**
  - Types and `photo.ts` as above.
  - `validateImage` checks the licence.
  - `checkImage(image: GarmentImage, info: ImageFileInfo)`: a `local-only` licence → `local-only` (skipped); git-ignored but not local-only → new state `ignored`, error text `"<file> is git-ignored, so a fresh clone and the public build won't have it: mark it \"licence\": \"local-only\" or commit it"`; then missing / too-small as now.
  - `formatImage` writes `licence` after `photographedSize`.
  - The picker passes `licence: garment?.image?.licence ?? 'local-only'`.
  - Seed licences per Global Constraints.
- [ ] **Step 4:** `npm run check` → PASS. The `data:check` report shows gildan-5000 and ryo-navy-graphic-tee as local-only and the other three as ok.
- [ ] **Step 5: Commit** "Photo licence on every garment image; data:check requires it"

### Task 2: Warp only licensed photos; leave local-only files out of dist

**Files:**
- Modify: `app/src/ui/components/Mannequin/Mannequin.tsx:44-51`
- Create: `app/build/leaveOutLocalPhotos.ts`
- Modify: `app/vite.config.ts`, `app/tsconfig.node.json` (`include` adds `build/*.ts`)

**Interfaces:**
- Consumes: `canWarp` and `localOnlyFiles` (Task 1).
- Produces: `leaveOutLocalPhotos(): Plugin`. Vite's `apply: 'build'`; at `closeBundle` it reads `src/domain/garments/seed.json` and `rm -f`s `<outDir>/<file>` for each `localOnlyFiles` entry.

- [ ] **Step 1:** In the Mannequin, `photoSrc` / `bottomSrc` are null unless `canWarp(garment.image)` holds. With no src there's no request, and the garment draws flat.
- [ ] **Step 2:** Add the plugin to `vite.config.ts`.
- [ ] **Step 3:** `npm run build && ls dist/garments` → only the three `own` ryo- PNGs. `npm run dev` → the grey polo is warped; Gildan and the navy tee draw flat (checked in the browser pane).
- [ ] **Step 4:** `npm run check` → PASS. Commit: "Warp only own and brand-permission photos; local-only files stay out of the build"

Note: local-only photos now also draw flat in `npm run dev`. That's the rule as written ("only own and brand-permission may be warped").

### Task 3: Dev tools off in production

**Files:**
- Create: `app/src/ui/devTools.ts`, `app/src/ui/devTools.test.ts`
- Modify: `app/src/App.tsx` (the `testMode` prop to BodyScreen and `testing` to FittingRoom)

**Interfaces:**
- Produces: `devToolsOn(storedTestMode: boolean, dev: boolean): boolean` (= `dev && storedTestMode`) and `DEV_TOOLS: boolean = import.meta.env.DEV`.

- [ ] **Step 1:** Test: `devToolsOn(true, false) === false`, `devToolsOn(true, true) === true`, `devToolsOn(false, true) === false`. Run it and watch it FAIL.
- [ ] **Step 2:** Implement. In App, BodyScreen gets `testMode` only when `DEV_TOOLS`, and FittingRoom's `testing` uses `devToolsOn(testMode, DEV_TOOLS)`. The stored value is left alone.
- [ ] **Step 3:** The landmark picker is already serve-only (`landmarksDevServer` has `apply: 'serve'`, and `landmarks.html` isn't a build input). Task 6's `dist:check` proves it.
- [ ] **Step 4:** `npm run check` → PASS. Commit: "Test mode is dev-only"

### Task 4: Base path, relative manifest, service worker

**Files:**
- Modify: `app/vite.config.ts` (`defineConfig(({ command }) => ({ base: command === 'build' ? '/Choudo/' : '/', … }))`)
- Modify: `app/public/manifest.webmanifest` (`"id": "./"`, `"start_url": "./"`, `"scope": "./"`, icon `src`s without the leading `/`)
- Modify: `app/scripts/app-icons.mjs`, only if it writes the manifest's icon paths (to check)
- Create: `app/public/sw.js`, `app/src/ui/registerServiceWorker.ts`
- Modify: `app/src/main.tsx` (call the register function when `import.meta.env.PROD`)

**Interfaces:**
- Produces: `registerServiceWorker(base: string): void` → `navigator.serviceWorker.register(`${base}sw.js`, { scope: base })`. It does nothing without `serviceWorker` in `navigator`.
- `sw.js` (classic script, one cache `choudo-v1`):
  - On install, it pre-caches `./` and `./manifest.webmanifest`.
  - Page loads (`mode === 'navigate'`) are network-first, falling back to the cached `./`.
  - Same-origin GETs under `assets/` (hashed, immutable) are cache-first.
  - Other same-origin GETs (icons, garments, fonts) are stale-while-revalidate.
  - Other origins pass through.
  - On activate, it deletes other `choudo-*` caches and calls `clients.claim()`.

- [ ] **Step 1:** Make the changes, then run `npm run build`. Check that `dist/index.html` has `/Choudo/favicon.ico`, `/Choudo/manifest.webmanifest` and `/Choudo/assets/…`. If Vite leaves public-file `href`s unprefixed, change them in `index.html` to `%BASE_URL%…`.
- [ ] **Step 2:** `npx vite preview` with a launch.json entry, open `http://localhost:4173/Choudo/` in the browser pane, and check:
  - The console has no errors.
  - `navigator.serviceWorker.controller` is set after a reload.
  - The manifest's icons resolve, with 200s in the network log.
  - Offline (SW cache only, via devtools), a reload still renders the app.
  - After a rebuild, a reload picks up the new asset hash.
- [ ] **Step 3:** `npm run check` → PASS. Commit: "Build for /Choudo/, relative manifest, offline service worker"

### Task 5: About page

**Files:**
- Create: `app/src/ui/screens/About.tsx`, `About.css`
- Modify: `app/src/App.tsx` (`screen` gains `'about'` plus the screen it returns to)
- Modify: `BodyScreen.tsx` (an "About Choudo" link after the privacy line) and `Closet.tsx` (an "About" quiet button in `screen-head`)

**Interfaces:**
- Produces: `About({ onBack }: { onBack: () => void })`.

Copy (exact, edit freely):
- "About Choudo" (h1)
- "Choudo shows how each size of a shirt or pair of pants would fit you before you buy. Enter your height and weight, and it compares each size's real measurements, from the brand's size chart, with yours, zone by zone, in centimetres."
- "Your data stays on this device. There's no account and nothing is uploaded: your body, likes, folders and outfits are saved in this browser only. Clearing the site's data removes them."
- "Affiliate disclosure: to come."
- Back button: "Back"

- [ ] **Step 1:** Build the page. Check it in the browser pane at 375 px and in dark mode: it opens from both entry points, Back returns to where you were, and the console is clean.
- [ ] **Step 2:** `npm run check` → PASS. Commit: "About page"

### Task 6: dist check and the Pages workflow

**Files:**
- Create: `app/scripts/distCheck.mjs` (pure), `app/scripts/distCheck.test.mjs`, `app/scripts/dist-check.mjs` (reads `dist/`)
- Modify: `app/package.json` (`"dist:check": "node scripts/dist-check.mjs"`)
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `CLAUDE.md` (Commands: dist:check, CI install; deploy section: URL, base, workflow, licence rule, dev-only tools, About)

**Interfaces:**
- Produces: `distProblems({ files: string[], indexHtml: string, manifest: object, localOnly: string[], base: string }): string[]`. `files` are dist-relative paths. It reports:
  - Any `src`/`href` in `indexHtml` that's root-relative but not under `base`.
  - A manifest icon or `start_url` that doesn't resolve to a file in `files`.
  - A missing `sw.js`.
  - Any `landmarks.html` or `dev/` path.
  - Any `localOnly` file present.

- [ ] **Step 1:** Tests: a clean fixture → `[]`, and one fixture per problem above → one message each. Run them and watch them FAIL. Then implement and run `npm run build && npm run dist:check` → exit 0.
- [ ] **Step 2:** Workflow:
  - Triggers: `push` to `main` and `workflow_dispatch`.
  - Permissions: `contents: read`, `pages: write`, `id-token: write`. `concurrency: pages` (no cancel).
  - Job `build` (`ubuntu-latest`, `working-directory: app`):
    - Checkout, then setup-node 24 with the npm cache keyed on `app/package-lock.json`.
    - `npm ci --ignore-scripts`, `npm rebuild esbuild`, `npm run check`, `npm run build`, `npm run dist:check`.
    - configure-pages, then upload-pages-artifact `app/dist`.
  - Job `deploy` (`needs: build`, environment `github-pages`): deploy-pages.
  - Pin each action to its current major (look up the latest release with `gh api` at implementation time).
- [ ] **Step 3:** Rehearse CI locally:
  - `git clone` the branch into the scratchpad, run the same five commands from `app/`, and check each exits 0. This proves the clone builds without the Gildan PNG and with install scripts skipped.
  - `actionlint` if it's available; otherwise check the YAML by eye.
- [ ] **Step 4:** Commit "GitHub Pages workflow and dist check", push, open the PR.

### Task 7: Go live (needs the user's OK at each GitHub step)

- [ ] **Step 1: Ask first.** Turn Pages on with source "GitHub Actions": `~/bin/gh api -X POST repos/YoshiRyo2/Choudo/pages -f build_type=workflow`. Pages isn't enabled today (the API returns 404). Check that the `github-pages` environment lets `main` deploy.
- [ ] **Step 2:** The user merges the PR (or tells me to). The push to `main` runs the workflow.
- [ ] **Step 3:** Open `https://yoshiryo2.github.io/Choudo/` in the browser pane on the mobile preset and check:
  - The page loads and the console is clean.
  - The service worker controls the page.
  - The manifest and icons return 200.
  - No Test mode, `/Choudo/dev/landmarks` returns 404, and `/Choudo/garments/ryo-navy-graphic-tee-front.png` returns 404.
- [ ] **Step 4:** Installing on a real phone is the user's check: Android Chrome → Install app, iOS Safari → Share → Add to Home Screen. Then open it from the home screen, in airplane mode too.
