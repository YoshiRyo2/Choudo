# Choudo — CLAUDE.md

Choudo is a virtual clothing try-on app. Users browse shirts and pants and see how each
**size** would actually fit a mannequin scaled to their height and weight. The core
promise is **true-to-size fit**: compare a garment's real measurements (from the brand's
size chart) to the user's body, zone by zone, and report the difference in cm.

Team of two: Ryo (data + fit engine), Derek (interface). Keep code readable; prefer small,
well-named modules over clever ones.

## Hard constraints (v1)
- **Guest only.** No accounts, no login, no backend user data. Anything stored stays on
  the device (`localStorage` on the web, the phone's key-value store in `mobile/`).
- **Analytics = GoatCounter, web production build only** (site code `choudo`, no cookies).
  It counts page views (with the URL's query, so `?utm_campaign=…&utm_source=…` links show
  up) and five fixed events, each once per session: `fitting-room-opened`,
  `fit-details-opened`, `discover-opened`, `closet-opened`, `garment-saved`. Nothing personal
  is ever sent: no body numbers, sizes, garment names or stored data. Only `ui/analytics.ts`
  talks to GoatCounter; never rewrite the page URL before its first count. `mobile/` has none.
- **Product links (phone only so far).** The Check tab reads Uniqlo US's public size-chart and
  product JSON for a pasted link (`domain/links/`). Only the product code goes to Uniqlo, never
  the body. Fetched garments live on the device (`choudo.fetched.v1`) and **never enter
  seed.json**. Brand photos show as they are (a thumbnail only), never warped onto the mannequin.
  The website gets this through a fetch service later (Uniqlo sends no CORS header).
- **No face, no photo, no camera.** Body input = height + weight + body type ("Size me in
  women's / men's clothes"), plus optional chest (full bust) / waist / hips / inseam
  overrides and, for a women's body, an optional bra size.
- **No AR, body scanning, or photo avatars yet.** Keep the mannequin behind one component
  so a 3D/SMPL renderer can replace it later — but don't build it.
- **Body proportions come only from the fit engine; drawing is a skin on top.** Any mannequin
  style changes the surface, never the body. Full wording in `docs/parked-ideas.md`.

## Stack
- React + TypeScript + Vite (web app, mobile-first), in `app/`.
- Vitest for unit tests (`*.test.ts` next to the code they test); component tests are `*.test.tsx`
  with `// @vitest-environment jsdom` + Testing Library (`ui/test/dom.ts` fills jsdom gaps).
- Mannequin is a 2D parametric SVG — no Three.js until a real body model is worth it.
- No state library, no UI kit. Plain React state, a small `localStorage` hook, plain CSS.
- Native iPhone app (being built, spec `docs/superpowers/specs/2026-11-23-native-iphone-app-design.md`):
  Expo SDK 58 + Expo Router in `mobile/`, Jest (`jest-expo`) + React Native Testing Library.
  The whole workspace uses one React, pinned exactly to SDK 58's (`19.3.0` in `app/` and `mobile/`):
  bump both together, with `npx expo install` for Expo packages.

## Layout
```
package.json     npm workspace root: packages/core + app + mobile. `npm install` and `npm run check` run here.
packages/core/   @choudo/core, shared by the web app and the native app. TypeScript source,
                 no build step; import as @choudo/core/domain/<path> or @choudo/core/ui-logic/<path>.
                 Never imports React, the DOM or app/ (its tsconfig has no DOM lib).
  domain/        the engine: pure TypeScript, never imports from ui-logic/
    units.ts     cm/in, kg/lb conversion. Everything internal is cm and kg.
    body/        estimateBody(input) -> BodyModel (men's power law for the torso; women's ANSUR II regressions;
                 both sexes' leg keys ANSUR II regressions),
                 braSize.ts (parse "34DD", US/UK cups, bust estimate)
    garments/    types.ts (schema), seed.json, normalize.ts (printed -> cm + provenance),
                 categories.ts (type -> template: tee | shirt | knit | pants | shorts | skirt | jacket | dress | leggings; CategorySpec data rules, weightOf),
                 chart.ts (per-measurement girth method, stretch, definitions),
                 validate.ts (structure), verify.ts + verifyRules.ts (stage-5 checks),
                 grade.ts (confidence grade), report.ts (npm run data:check text),
                 catalogue.ts (garments for a body type: its sizing + unisex, or all; publicGarments:
                 placeholder rows only with includeSamples, i.e. development or Test mode; categoriesIn)
    fit/         fitGarment(body, garment, size) -> per-zone fit results (rules.ts thresholds),
                 zones.ts (TemplateZones: each template's zones, rules, needed definitions),
                 pants.ts (bandHeight, girthAtHeight: where a waistband sits; the drawing reads it too),
                 shorts.ts (crotchToKneeCm), skirt.ts (band / hip-point / hem heights, legGirthAt,
                 strideGirthCm; the drawing reads them too),
                 tops.ts (length / sleeve body targets per definition, centre back included, HPS height; the drawing reads it too),
                 dress.ts (seam / hem heights, HPS to knee; the drawing reads them too),
                 leggings.ts (crotchToAnkleCm, leggingsHemHeight; the drawing reads it too),
                 layers.ts (what a top under a jacket adds: layerAllowanceCm, layerGrowCm; the drawing reads it too),
                 outfit.ts (fitOutfit: top, bottom or dress bare, the jacket over the top or dress, layer notes),
                 golden.test.ts + __golden__/ (byte-for-byte snapshot of every garment's fit and odds)
                 preference.ts (anchor tee / fit style -> personal verdict), sampleFit.ts
                 (seeded odds, recommendSize, measurementHint), uncertainty.ts (every spread),
                 random.ts, fitTestCsv.ts + fitTestReport.ts (npm run fit:report)
    links/       parse.ts (parseProductLink: the first link in pasted text → Uniqlo US product code
                 + colour, or unknown with its host and why: other region / not a product page),
                 uniqlo.ts (uniqloUrls: the size-chart and product requests; uniqloToSeedGarment: the
                 responses → a tee / long-sleeve tee seed row, cm, chest flat, length and sleeve from the
                 centre back, tier B, plus price, photo URL and the cleaned link as FetchedProduct;
                 readyFetchedGarment: validateSeed + normalizeGarment, null when it fails),
                 __fixtures__/ (trimmed real Uniqlo responses). No fetch, no React.
  ui-logic/      the UI's pure helpers, kept at their app/src/ui sub-paths
    screens/     bodyForm.ts, bodyFieldErrors.ts (per-field checks shown on blur), bodyPreview.ts
                 (a typical body until height + weight are valid), anchorForm.ts
    components/  Mannequin/ (geometry.ts, topShape.ts, templates/pants.ts + skirt.ts + jacket.ts + dress.ts + leggings.ts,
                 photoWarp.ts, view.ts: Front/Back is a drawing option only — same body, same fit, same pins;
                 heads.ts: cloud / peach / bunny head layout), Stamp/stampGlyphs.ts (generated by
                 app/scripts/stamp-glyphs.mjs), SwipeCard/swipe.ts, sizeRow.ts, garmentThumb.ts (picks a card photo)
    state/       stored.ts (keys + guards), persist.ts (readStored / writeStored on any StorageLike), outfit.ts, feed.ts (likes/passes, feed order), closet.ts
                 (folders, saved outfits; shownLikes / showsOutfit / shownFolderItems skip what the catalogue hides), odds.ts (cached sampleFit), fitTests.ts (Test mode records + CSV),
                 stampSeen.ts (which stamps have dropped this session; sessionStorage), migrate.ts,
                 fetched.ts (the fetched list: addFetched max 30 newest first, 7-day isFresh, readyFetched
                 drops rows that fail the seed checks; addUnsupportedHost max 50)
    checkText.ts the Check tab's wording and its blameless error lines (linkError, canRetry)
    fitText.ts   all user-facing fit wording (and isJustRight: when the ちょうど stamp shows), incl.
                 reliabilityText / reliabilityAction and whyLine ("M gives you 8 cm of room at the
                 chest; L gives 14 cm.", DECIDING_ZONE per template); catalogueText.ts;
    reliability.ts  reliability(fit, garment, { hasFitReference }) -> good | fair | rough + reason
                 (RELIABILITY_RULES: a first guess until the fit test);
                 closetText.ts (outfitLine, shared by the web Closet and the phone's)
app/src/
  ui/            React (app icons and favicon: app/public/, made by npm run icons)
    screens/     BodyScreen (input), AnchorScreen (fit reference), FittingRoom (browse + size + fit),
                 FitTestPanel (Test mode), Discover (swipe feed), Closet + closet/ (Liked, Folders, Outfits tabs)
    components/  Mannequin/ (Mannequin.tsx: the SVG; MascotHead.tsx: the fit-reactive face, a skin laid out
                 from g.head; skin.test.tsx checks the body and garments are identical under every head),
                 Stamp/ (the ちょうど seal, useStampDrop), SwipeCard/,
                 FitAnswer ("M fits you", verdict line, why-line in cm, reliability line over the stage),
                 GarmentIcon (card picture: photo or flat drawing),
                 GarmentCarousel, GarmentBadge, SizePicker, FitReadout, FitSheet, Sheet (<dialog>), TabBar, NameForm,
                 AboutSheet (from the body screen and the Closet header),
                 ConfirmButton, TapeScale, SegmentedControl, NumberInput
    state/       usePersistentState (localStorage), useCloset.ts
    motion.ts    the figure's hop when the stamp lands (translate only)
    focus.ts     refocus after a remount without a tap-drawn ring (`[data-pointer-focus]`)
    analytics.ts track(event): the fixed GoatCounter events, once per session; a no-op without it
    styles.css   design tokens (colours, type scale; spec: docs/superpowers/specs/2026-11-22-playful-reskin-design.md)
  dev/landmarks/ dev-only landmark picker (/dev/landmarks), tops and pants: suggest.ts (landmarks
                 from the outline), seedWrite.ts (writes one "image" into seed.json), pickerModel.ts
                 (a kit per template: place order, labels, diagram)
mobile/        @choudo/mobile, the Expo app (iPhone; portrait, light, bundle id com.choudo.app)
  app.json + app.config.ts  the app's config (name, bundle id, version 1.0.0, iPhone portrait light,
                 icon and splash from npm run icons, ITSAppUsesNonExemptEncryption false, a privacy manifest:
                 no tracking, no data collected); app.config.ts adds `extra.appVariant` from APP_VARIANT
                 ('production' unless eas.json's preview profile says 'preview')
  eas.json       EAS Build profiles: development (dev client), preview (internal, Test mode on),
                 production (autoIncrement); release steps in docs/app-store-release.md
  assets/        images/ (icon.png 1024 px RGB no alpha, splash-icon.png, favicon, Android layers: all
                 written by app/'s npm run icons), fonts/ (M PLUS Rounded 1c 500/700/800, Latin subsets
                 from npm run fonts, OFL.txt; src/tests/font-coverage.test.ts checks every character the
                 copy draws is in them)
  src/app/       routes only (Expo Router): _layout.tsx (root Stack in a GestureHandlerRootView: runs
                 migrations, loads the fonts from assets/fonts, holds the splash), (tabs)/ (NativeTabs: Check, Fitting room, Discover, Closet; redirects to
                 /body until a body is stored), index.tsx (`/` redirects to `/check`: the app opens there), body.tsx (first run, or Edit body), fit-reference.tsx
                 (`?first=1` on first run: no back swipe, always on to the tabs), about.tsx (form sheet),
                 fit-details.tsx (form sheet `?garmentId=&size=&from=fitting|browse`: from the Fitting
                 room "Done" / "Wear M", a worn jacket fitted over the top under it; from browsing "Try M
                 in the fitting room"; an unknown id closes it), save-outfit.tsx (form sheet: saves the
                 resolved outfit under a name or the next "Outfit N"), folder-picker.tsx (form sheet
                 `?kind=garment|outfit&id=&title=`: a checkbox per folder, New folder; closes itself when the
                 item is no longer liked or saved), folder/[id].tsx (pushed, the folder's name as the title,
                 Rename and Delete in the header, native back; a folder that's gone goes back),
                 share-outfit.tsx (form sheet `?id=`: the share card, then captureRef 1080 × 1350 PNG and
                 expo-sharing's sheet; a cancel says nothing, no sharing says so),
                 dev/mannequin.tsx (the mannequin lab; redirects to /fitting-room unless __DEV__, so never in a store
                 build; the Fitting room shows its button in development only).
                 (tabs)/check.tsx is the Check tab ("What size should I buy?": paste a Uniqlo US link,
                 useLinkCheck; "Try it on" wears it and navigates to /fitting-room; "Open at Uniqlo" in
                 expo-web-browser). (tabs)/fitting-room.tsx is the Fitting room (anything that means it
                 goes to `/fitting-room`; a stale sheet on a cold start goes home, `/`). (tabs)/discover.tsx is Discover: native tabs all
                 render at launch and stay mounted, so it draws nothing until first opened, then builds a
                 fresh feed when the tab regains focus with swipes changed elsewhere (useFocusEffect bumps
                 `feedKey`), never while it's on screen or when a sheet over it closes; it reads body,
                 preference, catalogue and closet only (not useWardrobe). Fit details opens `from=browse`.
                 (tabs)/closet.tsx is the Closet, also drawn only once first opened.
  src/storage/   kv.ts (expo-sqlite/kv-store as a StorageLike; runMigrations)
  src/links/     fetch-uniqlo.ts (fetchUniqlo: both requests in parallel, 10 s timeout, one retry on a
                 network error → ok / not-found / network / blocked; checkUniqloLink: the stored copy under
                 7 days old, else Uniqlo's, else (offline or blocked) an older stored copy),
                 use-link-check.ts (the Check tab's flow: parse, fetch, store, the hosts it can't read)
  src/hooks/     use-persistent-state.ts (the web hook's twin on kv), use-body.ts, use-units.ts,
                 use-garments.ts (publicGarments with __DEV__ or Test mode on (DEV_TOOLS): Discover's catalogue; the
                 Fitting room's is the fetched garments first, then this, tagged "From your link"),
                 use-fetched.ts (the fetched list and unsupported hosts; GarmentLookupContext, provided by the root
                 layout: every screen finds a garment by id through useFindGarment, so outfits, likes and fit details
                 can point at a fetched one; a dropped one isn't found and is skipped, never deleted),
                 use-fit-reference.ts (anchor + fit style together), use-test-mode.ts, use-fit-tests.ts
                 (Test mode's results, the fitTests key), use-head.ts
                 (the mascot head; _layout.tsx provides it through MascotHeadContext), use-closet.ts (the
                 web useCloset), use-outfit.ts, use-catalogue.ts, use-preference.ts (preferenceSpec, memoised),
                 use-wardrobe.ts (body model, units, catalogue, what it shows and the resolved outfit, for the
                 Fitting room and its sheets), use-odds-queue.ts (one garment's odds per setTimeout(0) tick
                 after the first render, cached ones at once: the Closet's tiles fill in rather than freeze),
                 use-leave-if.tsx (a sheet or screen whose item is gone goes back), use-prefetch-odds.ts
                 (the same queue into core's odds cache only, never re-rendering: the Fitting room's and
                 Discover's garments next in line, paused while their tab isn't on screen). forgetThisLaunch()
                 (use-persistent-state) lets route tests start from storage alone.
  src/theme/     colors, type + fonts (M PLUS Rounded 1c via useFonts), radius, spacing — from styles.css
  src/components/ themed-text, button (`disabled` = the web's aria-disabled: dimmed, still pressable),
                 number-field (decimal pad, unit inside; also the bra-size text box), field-error,
                 segmented (@expo/ui's native segmented control, `hideLabel` keeps the label for VoiceOver
                 only; Jest gets its JS twin, jest.setup.ts), wordmark,
                 Fitting room parts, ports of the web components of the same names: garment-icon (bundled
                 photo via thumbPhotoSrc + photoSource, else the flat drawing), garment-badge, fit-answer,
                 size-picker (radio chips; `row` keeps the pick centred), tape-scale, garment-carousel
                 (snapping FlatList: the card that settles in the middle is selected), fit-readout ("View
                 the chart" in expo-web-browser), name-form, tone.ts (fit tone → colour), hop.ts (useHop:
                 the figure's translate-only hop, none under Reduce Motion), stamp/ (Stamp with Reanimated,
                 no ink-noise filter, onLanded at 55 % for the haptic; useStampDrop),
                 swipe-card.tsx (the web SwipeCard: a Gesture Handler pan raced with a tap, on Reanimated;
                 swipe.ts decides, `decideDrag` turns px/s into px/ms, `leanFor` is tilt as a worklet;
                 Like / Pass / Fit details accessibility actions; NextCard, the plain stand-in behind),
                 folders-button.tsx ("Add to folder" / "In N folders").
                 mannequin/ — the web Mannequin.tsx + MascotHead.tsx ported to react-native-svg, same props,
                 same draw order; every shape comes from @choudo/core, this only paints it:
                   index.tsx (Mannequin, WornGarment), mascot-head.tsx (+ MascotHeadIcon), height-tape.tsx,
                   photo-texture.tsx (the photo declared once, a clipped, transformed <Use> per warp
                   triangle), head-context.ts,
                   paint.ts (Mannequin.css as SVG props: color-mix → opacity or mixHex, brightness → shadeHex;
                   the web's px line widths × `unit` = px(1, drawn width), so outlines are the same
                   points at any size), garment-photos.ts (GENERATED by `npm run photos`: a require() per
                   own / brand-permission / affiliate-unaltered photo, never local-only; photoSource gives
                   the module and pixel size, or null → flat colour), svg-tree.ts (test helper)
  src/utils/     color.ts (mixHex, shadeHex), odds-log.ts (development only: `[odds] key: ms` the first
                 time each garment's odds, or the outfit's default sizes, are worked out; none in a store build),
                 confirm-delete.ts (confirmDelete: a native alert, Cancel + destructive Delete; window.confirm
                 on the web) — deleting a folder or an outfit always goes through it, dev-tools.ts
                 (DEV_TOOLS = __DEV__ or the preview variant: gates Test mode's switch and panel, never in
                 production; the mannequin lab stays __DEV__ only), export-fit-tests.ts (core's fitTestsCsv
                 to a cache file with expo-file-system, then the share sheet)
  src/screens/   body/ (BodyScreen + estimate-list; the mannequin preview, a typical body until yours),
                 check/ (CheckScreen: field, inline loading, errors with Retry where it helps, recent checks,
                 Test mode's unsupported hosts; result-card.tsx: name, price, the brand photo as a thumbnail,
                 FitAnswer with `details` (why-line + confidence line, as the web), SizePicker chips),
                 fit-reference/ (FitReferenceScreen: choose / catalogue / measure / style steps, tee-diagram),
                 dev/mannequin-lab.tsx (every garment, size, head, face, side and frame, height ±5 cm,
                 fit pins via fitOutfit; nothing saved), fitting-room/ (FittingRoom, the web screen top to
                 bottom; stage.tsx: circle, hopping figure, heads, stamp, Save outfit; haptics on picks and
                 when the stamp lands; odds only for the open tab's garment), fit-details/, save-outfit/,
                 discover/ (Discover: the feed is built when `feedKey` or the scope changes, never on a
                 swipe; one decision per card, a light impact on each, replaced at once under Reduce Motion),
                 closet/ (Closet: Liked / Folders / Outfits, not stored; liked.tsx, outfits.tsx,
                 folders.tsx, tile.tsx (the shared tile frame, two a row), outfit-figure.tsx (OutfitFigure,
                 wornOf)), folder/ (one folder's items), folder-picker/, share-outfit/ (ShareOutfit +
                 share-card.tsx: 360 × 450 pt, the mannequin, the outfit's name, each garment and size, the
                 wordmark; never the body in words), fit-test/ (FitTestPanel, the web's, under the
                 Fitting room's sizes when Test mode is on). The Fitting room and Discover work the odds of
                 the garments next to the one on show out ahead with usePrefetchOdds (a jacket's over the top
                 under it), so swiping on is instant. Screens take props and call back; the routes in src/app/ do storage and
                 navigation. Wording and validation come from @choudo/core, copied from the web screens.
  src/tests/     tests that render routes (not in src/app: expo-router would treat them as routes)
                 Other tests sit next to their code (`*.test.ts(x)`); jest.setup.ts mocks the kv-store,
                 loads Gesture Handler's jestSetup (fire gestures with its jest-utils; wrap a GestureDetector
                 in GestureHandlerRootView) and runs Reanimated's setUpTests (jest.config.js uses
                 Reanimated's resolver). renderRouter runs on fake timers.
  scripts/       garment-photos.mjs (npm run photos: writes src/components/mannequin/garment-photos.ts
                 from seed.json; run it after adding or re-licensing a photo), subset-fonts.mjs (npm run
                 fonts: the Latin font subsets in assets/fonts; rerun if the copy needs a new character)
  jest/          garment-photo-transformer.js (tests see app/public/garments PNGs registered like Metro
                 does, with their real pixel size)
app/dev/       landmarks.html + landmarksServer.ts: the picker page and its save endpoint,
               Vite dev server only (apply: 'serve'), never in npm run build
app/build/     build-only: pagesBase.ts (PAGES_BASE '/Choudo/'), leaveOutLocalPhotos.ts (Vite
               plugin: deletes local-only photos from dist/), serviceWorker.ts (stamps dist/sw.js),
               goatCounter.ts (adds GoatCounter's script to the production index.html; vite
               preview strips it; never on the dev server or under Vitest)
app/public/sw.js  service worker (offline), registered by the production build only; it never
               touches other sites, so GoatCounter (gc.zgo.at, goatcounter.com) is never cached
app/public/privacy.html, support.html  static pages the App Store listing links to (the site's tokens and its
               own font files in public/fonts/); dist:check fails without them or a link back to the app
.github/workflows/deploy-pages.yml  checks core + app, builds app/ and deploys it to GitHub Pages on every push to main
app/scripts/   stamp-glyphs.mjs (one-off: ちょうど outlined from Shippori Mincho B1, OFL, via opentype.js),
               data-check.mjs (npm run data:check), fit-report.mjs (npm run fit:report),
               garment-photos.mjs (npm run photos: AI cut-out via photo-model.mjs, BiRefNet-lite,
               MIT; mask clean-up in photo-mask.mjs). Model weights download to app/.models/
app/chart-snapshots/, app/photo-sources/   local copies of charts and source photos, git-ignored
app/public/garments/   committed cut-outs the app shows (not ones from retailer photos, listed in app/.gitignore)
docs/          adding-garments.md (checklist for adding a garment by hand), app-store-release.md
               (Ryo's step-by-step: Apple Developer, EAS, TestFlight, fit-test builds, the listing),
               clothing-categories-design.md (design + PR plan for categories beyond tees),
               parked-ideas.md (ideas on hold, and the rules that still hold for them)
data/fit_tests.csv    (repo root) fit-test results, pasted from Test mode's CSV export.
```
Rule: **body estimation, the fit engine, garment data and pure UI logic live in
`packages/core`** with clear inputs/outputs and unit tests; it never imports React, the DOM
or `app/`. The UI only calls their public functions.

## Fit rules (summary — source of truth is `domain/fit/`)
- Zones come from the garment's **template** (`TYPE_TEMPLATE` → `TEMPLATE_ZONES` in `zones.ts`),
  never from `category === 'top'` checks. A new category is a template: zones + rules + data
  checks (`CATEGORY_SPECS`) + a drawing. See `docs/clothing-categories-design.md`.
- Girth zones (chest, waist, hips, thigh): ease = garment − body (cm).
  Labels: tight / fitted / relaxed / loose (ported from `src/fit.py`, converted to cm).
- Length zones (top length, sleeve, inseam): garment − target length derived from body.
  Labels: short / good / long.
- Missing or unverified garment measurements give `unknown`, never a guess
  (same rule as `src/report.py`'s "Method unverified").
- Flat (half-chest) chart values are doubled to full circumference.
- A top's length is only scored when the chart says where it starts: the high point of the
  shoulder (`hps`), or the centre back (`center_back`, target = torso − `BACK_NECK_DROP_CM`, as
  knits); a tee's sleeve only when it's `shoulder_to_cuff` on a long sleeve.
- A size's overall result is never "good" when a girth couldn't be checked; it's "unknown"
  (unless something is definitely bad). `recommendSize` never picks a size on length alone.
- Stretch fabric moves the "tight" boundary (`STRETCH_ALLOWANCE` in `rules.ts`; `compression`
  is assumed). Stretch can be per measurement (`{ default, waist: "high" }`) and a rule can set
  its own allowance.
- A girth rule's bounds are cm, or (`scale: "fraction"`) a share of the body, which may be
  negative (leggings). Landing zones (`kind: "landing"`) only say where an edge ends; they never
  change the overall result or the suggested size, **unless they block** (`LandingRule.blocks`:
  the garment won't go on or stay up — then the size is bad). New thresholds ship labelled "assumed".
- A zone may be `optional` (thigh, rise, leg opening): when it can't be scored the size isn't
  "unknown" because of it. A zone's body target may be worked out (`ZoneSpec.bodyTarget`).
- Pants zones: waist, hips, thigh, rise, inseam, leg opening. The **waist is compared where the
  band sits**: `bandHeight` = navel height − `RISE_VERTICAL_RATIO` × (body front rise − garment
  front rise), and the body girth there is interpolated between navel (waist) and hip line (hips).
  Without a front-rise definition the band is at the navel. Rise is a landing zone (low / mid /
  high) that is bad **only** when the band lands below the hip line; leg opening is a landing
  zone against the heel–ankle girth (skinny / slim / straight / wide) that is bad **only** when it
  can't pass the heel with no stretch and no `ankleZip`. Thigh needs `definitions.thigh`.
  Thresholds (`THIGH`, `RISE`, `LEG_OPENING`) are assumed.
- Shorts (template `shorts`, category bottom): the pants waist, hips, thigh and rise as they are;
  the inseam is a landing zone against crotch-to-knee (`SHORTS_INSEAM`: mid-thigh / above knee /
  knee, assumed); no leg-opening zone. Drawn with `pantsShape` (the hem the inseam below the
  body's crotch, as the fit lands it).
- Skirts (template `skirt`, category bottom): waist at the band (`definitions.waist` natural / mid /
  low → `SKIRT_BAND_DROP_CM` 0 / 4 / 8 cm below the navel, assumed; none or unknown → the navel);
  hips at `chart.hipsBelowWaist` below the band, or the fullest hips without it; length (needs
  `definitions.length: 'waist'`) a landing against band-to-knee (`SKIRT_LENGTH`: mini / above knee /
  knee / midi / maxi, assumed); walking room (`hemSweep` vs `strideGirthCm` at the hem, legs
  `STRIDE_ANGLE_DEG` 40° apart, assumed) is an optional landing whose `restricted` mark has tone
  warn (`LandingRule` mark `tone`) and never decides the size. All in `domain/fit/skirt.ts`.
- Woven shirts currently use the tee chest thresholds — likely too strict; tune in `rules.ts`.
- Knits (hoodie, sweatshirt, sweater, cardigan → template `knit`, worn as a top): chest, length,
  sleeve (long only) and hem band (optional). Chest = the top chest rule with fitted / relaxed /
  ideal moved out by `KNIT_EASE_OFFSET_CM` (10, assumed from Gildan's 18500 vs 5000 grading); the
  personal target moves by the same offset, and knits are never anchors. Length accepts `hps` or
  `center_back` (target = torso − `BACK_NECK_DROP_CM`, 2, assumed); sleeve accepts
  `shoulder_to_cuff` or `center_back_to_cuff` (target = arm + shoulder / 2 + `SHOULDER_CURVE_CM`,
  men 5.3 / women 5.5 from ANSUR II spine-to-wrist means). `bodyAt: 'centre_back'` marks those
  targets. Hem band (relaxed rib) vs hips, `HEM_BAND` (assumed); rows give `stretch.hemBand: high`.
  Tees and shirts score `hps` or `center_back` length the same way (Uniqlo charts tees from the
  centre back), but still only `shoulder_to_cuff` sleeves.
- Jackets (jacket, coat → template `jacket`, category **`outer`**, worn over the top): chest and a
  charted waist are `layered` zones; shoulder (optional, `JACKET_SHOULDER` ±1.5 cm fitted); sleeve as
  knits; length a landing against the hip line (`JACKET_LENGTH`: cropped / hip / thigh /
  knee-length / calf). Chest = the top chest rule moved out by `JACKET_EASE_OFFSET_CM` (13, assumed
  from J317's grading); the personal target moves too, no personal length; jackets are never
  anchors. No bicep zone yet (no chart or body key). All thresholds assumed.
- Dresses (type `dress` → template `dress`, category **`onepiece`**, in place of the top and the
  bottom): bust (required, `DRESS_GIRTH_RULES` = `TOP_CHEST` for every sizing, assumed), shoulder
  (optional, `JACKET_SHOULDER`, when charted), sleeve (as knits), waist (optional, when charted, at
  the navel; scored only for `definitions.waistSeam` `natural` or `none`: empire needs an underbust,
  drop and unknown can't be placed), hips (optional, when charted, `BOTTOM_HIPS` at the fullest),
  length a landing with the skirt's marks against HPS → mid-knee (`bodyAt: 'shoulder_knee'`; the HPS
  height is `hpsHeightCm`, `HPS_BELOW_TOP_RATIO` 0.165 below the head, assumed: the mannequin's own),
  walking room as skirts at the dress's hem. Objective only (`personal: null`), worded as bottoms
  (`objectiveOnly` in `fitText.ts`). Heights in `domain/fit/dress.ts`. Sleeveless isn't supported yet.
- Leggings (type `leggings` → template `leggings`, category bottom): waist at the band (as pants;
  `LEGGINGS_WAIST`), hips (required), thigh (optional, needs `definitions.thigh`) and calf (optional,
  garment key `calf`) on `LEGGINGS_GIRTH`, all `scale: 'fraction'` with their own stretch allowances.
  Hips / thigh / calf: ideal −8 %, fitted to −2 %, relaxed to +3 %, tight below −5 % less the
  allowance (compression 0.13 → −18 %, high 0.08 → −13 %). Waist: ideal −8 %, fitted to 0, relaxed to
  +4 %, tight below −8 % (compression −16 %): Sport-Tek cuts the band at the natural waist, about 8 %
  under ANSUR II's navel waist. Length is a landing against crotch → ankle bone (`bodyAt: 'ankle'`,
  `LEGGINGS_LENGTH`: capri / 7/8 from −16 / ankle from −5 / stacked from +4 cm, tone warn). All assumed.
  Objective only. Labels read "Too much squeeze" / "Baggy" (`zoneLabelText(z, template)`), girth
  sentences give the share under the body, and the inseam is called "Length" (`zoneTitle`).
  `stretchAssumed: true` marks a stretch level the chart doesn't give (readout source line, data report).
- Layering (`domain/fit/layers.ts`): charts and bands are bare-body; a jacket assumes something light
  under it (`OUTER_ASSUMES`). With a top under it (`fitGarment(…, under)`), layered zones compare with
  the body + `layerAllowanceCm`: `LAYER_BULK_CM[weight] − LAYER_BULK_CM.light` (light 0.5 / mid 2 /
  heavy 3.5) + `UNDER_EASE_KEPT` (0.25) × the top's chest ease beyond fitted; waist the same. Zones
  say `bodyAt: 'over_layer'`, the fit `over: { garmentId, type }`. `fitOutfit` adds notes (never
  labels): hem shows (> 1 cm), cuffs show (> 1 cm), bunches (top's ease > the jacket's over the
  layer). **Size cards stay bare-body**; only the Fitting room, with a top on, fits over it.
  `sampleFit(…, { under })` works the layer out from each sample's own body draw (one draw shared
  by both layers); the top's chart offsets draw from `keyedSeed(seed, 'under:' + key)` streams.
- Top chest/waist thresholds go by the **garment's** sizing (`TOP_GIRTH_RULES`): women's cuts use
  `WOMENS_TOP_CHEST` (fitted to +1 in, relaxed to +3 in — assumed, not sourced yet); men's and
  unisex keep the men's numbers on any body. Bottoms use one set for everyone.
- One chest zone in the engine; `fitText.ts` calls it **Bust** for a women's body
  (`zoneName`, `describeZone`, `summarize`, `measureHintText`; `GarmentFit.bodyType`).

## Body estimates (source of truth is `domain/body/`)
- `bodyType: "womens" | "mens"` on the body input (men's is the default and v1's).
- Men's girths: power law from an ANSUR II-rounded reference body (unchanged since v1).
- Women's bust, waist, hips and inseam: least-squares on height and weight over the ANSUR II
  female public data (1,986 women), each coefficient cited with R² and residual SD in
  `estimateBody.ts`; results are clamped to `INPUT_LIMITS`. ANSUR II's waist is at the navel.
- Bust, best first: measured full bust → bra size (band + cup inches, A = 1; US and UK letters
  differ after D) → height + weight. A bra-size bust stays "estimated" (`BodyModel.bra`) with
  its own spread (`BRA_BUST_SD_CM`).
- A cup above C widens the torso-length spread (`CUP_TORSO_SD_CM_PER_IN`) — an assumption,
  never a shift in the length itself.
- Leg keys (pants; estimated only, none can be entered yet): thigh, knee (just above it), calf,
  heel–ankle, front rise, and navel / hip-line (fullest seat) / knee heights. Both are least squares
  on height and weight over ANSUR II: `WOMENS_LEG_REGRESSION` (female file) and `MENS_LEG_REGRESSION`
  (male file, 4,082 men), each cited with R² and residual SD; spreads are the residual + 0.5 cm,
  rounded up to the next half. The men's inseam is still `0.45 × height` (not re-fitted).
  Heights are kept in order (ankle < knee < crotch < hip line < navel); an entered inseam never moves.
- Ankle height (`ankleHeightCm`, floor to the ankle bone, leggings): women's ANSUR II
  `lateralmalleolusheight` regression (R² 0.19, SD 0.46 cm); men's the same column (R² 0.25, SD 0.49 cm).

## Personal fit and odds (source of truth is `domain/fit/`)
- Zone labels stay objective. The **verdict** is personal: fits how you like / a bit snugger /
  roomier / much roomier / too tight / shorter / longer / "as designed" / unknown.
- Preference: an anchor tee (catalogue garment + size, or measured flat) beats a stated style
  (Slim / Regular / Relaxed / Oversized) beats the Regular default. Anchors are stored as entered
  and worked out against the current body; an anchor's ease is turned into its regular-cut
  equivalent. Targets and bands per style / fitIntent are `INTENT_EASE` in `rules.ts`.
- Relaxed and oversized designs win when their ease is above the user's ("Oversized, as
  designed"); slim and regular cuts are sized to the user. Jackets aim at the tee target + `JACKET_EASE_OFFSET_CM`. Pants, shorts and skirts have no personal target yet.
- `sampleFit` draws body, garment and preference 500 times (seed fixed) and returns per-size
  label, personal and verdict odds. Every spread is in `uncertainty.ts`, each with its source;
  estimated body spreads are per body type (women's from the ANSUR II residuals).
  One body draw is shared by all sizes and the anchor, so an anchor cancels chest-estimate error.
  It draws every schema key: the original 7 body and 8 garment keys from the main stream in a
  fixed order (`MAIN_STREAM_*_KEYS`, frozen — never add to them), and every later key from its own
  stream (`keyedSeed`), so adding a key never moves an existing result. New keys still go at the
  end of `MEASUREMENT_KEYS` / `BODY_MEASUREMENT_KEYS`.
- The golden test (`fit/golden.test.ts`) must stay byte-equal through refactors. When a change
  is meant to move results, regenerate it from `packages/core` with
  `npx vitest run domain/fit/golden.test.ts -u` and review the diff.
- `recommendSize` = highest chance of "fits how you like"; ties go roomier; still null for
  unscored garments or with no girth to score. `measurementHint` names the estimated
  measurement that, measured, could change the size.
- Verdict wording thresholds (Very likely ≥ 75%, Probably ≥ 50%, else Might; close call
  within 15 points, both ≥ 25%) are in `fitText.ts`.
- **No percentages in the consumer UI.** `verdictLine().detail` is the reliability line, never a
  chance; the per-zone odds (`labelOddsText`, `personalOddsText`) and the "Chances come from 500
  tries" note show in Fit details only with Test mode on (web `testing`, phone `DEV_TOOLS && useTestMode`).
  `formatPercent` and the odds stay for Test mode and `npm run fit:report`.
- Reliability (`ui-logic/reliability.ts`, wording in `fitText.ts`): **rough** for a placeholder, when
  a non-optional zone of this size compares an estimated garment number (`garmentOrigin:
  'estimated'`), for an unscored grade, or when half the size's needed zones can't be checked — the
  grade `estimated` alone doesn't make it rough (Gildan 18500's estimated hem band is optional);
  **good** with a verified / charted grade and every needed girth typed in (or a top's chest covered
  by an anchor tee); **fair** otherwise, naming the first estimated girth with an "Add your
  measurement" link to Edit body, or "a few of this garment's numbers are estimated" (`estimated-extras`). Shown as FitAnswer's last line and at the top of Fit details; estimated body numbers there
  carry `ESTIMATED_MARK`. The rules are a first guess (`RELIABILITY_RULES`) until the fit test.
- Why-line (`whyLine` in `fitText.ts`, web Fitting room and the phone's Check tab): the deciding girth (`DECIDING_ZONE`:
  chest for tops / knits / jackets / dresses, waist for bottoms) for this size and the next size up
  (down for the largest), whole cm or inches to the half; leggings "stretch"; null when unscored.

## Garment data rules (source of truth is `domain/garments/`)
- Garments live in `packages/core/domain/garments/seed.json`. To add one by hand, follow
  `docs/adding-garments.md`. Garments read from a pasted link (`domain/links/`) live on the
  device only and never enter seed.json; they go through the same validateSeed + normalizeGarment.
- Every real row has a source tier (A brand spec … G photo only), `url`, `capturedOn`, and
  optionally a `snapshot` of the chart. Placeholders have `placeholder: true` and no tier.
- **Placeholders are development / Test mode only.** `publicGarments(GARMENTS, { includeSamples })`
  drops them unless `includeSamples` (web: `import.meta.env.DEV` or Test mode, in `App.tsx`; phone:
  `__DEV__` or Test mode where DEV_TOOLS allows it, `use-garments.ts`). The web reads only that list (Fitting room, Discover, Closet); stored
  likes, folder items and outfits that point at a hidden garment are skipped, never deleted, and a
  worn one is swapped by `resolveOutfit(…, shown, available)`. A category with no garments for this
  body loses its tab or filter rather than showing an empty list. Keep the placeholders in seed.json:
  tests use them. Today the public catalogue has no pants (only shorts, a skirt and leggings).
- `chart.girth` is one method or per girth (`{ default, hips: "flat" }`); only a girth whose
  method is unknown goes unscored. Definitions (length, sleeve, rise, thigh) go in
  `chart.definitions` or the older `lengthDefinition` / `sleeveDefinition`, not both.
- Seed values are copied as printed. A value is a plain number (from the chart) or
  `{ value, origin: chart | estimated | audited, how }`. `normalizeGarment` converts to cm
  and keeps each value's origin, printed number and conversions (`GarmentSize.provenance`).
- Every row has `sizing: "mens" | "womens" | "unisex"` (who the chart is cut for). Gildan 5000
  and Knightweave are unisex; the Lands' End A-line skirt is the first women's row; Port Authority
  J317 (men's) and L317 (women's) soft shells are the first jackets (SanMar spec sheets, tier B); Lands' End's
  sheath (505999) and surplice (441021) are the first dresses (item-dimension PDFs, tier B); Sport-Tek
  LPST890 (7/8 legging: waist + inseam only, so its hips read "can't check") and LPST880 (fitness pant
  typed leggings: waist, hip, inseam) are the first leggings (SanMar spec pages, tier B, stretch assumed). The Fitting room and Discover show the body type's sizing plus
  unisex, with a shared "Show: … & unisex | All" toggle (`catalogueFor`); a worn garment
  stays on even when hidden.
- `checkGarment` (stage 5) returns errors and warnings. Errors leave the garment out of the
  catalogue and fail `npm run data:check`: a sizing other than the three above, a size smaller
  than the one before, or a flat girth that looks like a full circumference (or the reverse). Warnings need review:
  uneven grading, implausible ranges, chest ease for the fit intent, and audit vs chart.
  Thresholds are in `verifyRules.ts`.
- Knit rows may give `hemBand` (relaxed rib, a girth: doubled when flat; last in `MEASUREMENT_KEYS`) and
  `weight` (`light | mid | heavy`, for layering later; `weightOf` falls back to the template's
  default: tee/shirt light, knit/pants mid). Knit checks: `KNIT_RANGES`, centre-back sleeve range,
  their own flat-chest limit, `hemBand ≤ chest`; `scoredDefinitions` per template says which
  length / sleeve definitions are scoreable (kept equal to the zones' `needs` by a test).
- Jacket checks: `JACKET_RANGES` (chest 85–190, shoulder 38–62), `JACKET_SLEEVE_RANGES`,
  `JACKET_LENGTH_RANGES` (jacket 50–100, coat 70–125), the knit flat-chest limit, no tee chest-ease
  check; length definition `hps | center_back | unknown`; an outer can't have an ankle zip; no photo
  landmarks yet (`landmarks: null`).
- Dress checks: `DRESS_RANGES` (chest 70–170, waist 55–160, hips 75–175, sweep 70–400, shoulder
  30–55), `DRESS_LENGTH_RANGES` (70–160 from HPS), sleeve as jackets, `waist ≤ hips`; a sleeve is
  required; length definition `hps | center_back | unknown`; `waistSeam` only on dresses; no photo
  landmarks yet.
- Shorts checks: `SHORTS_RANGES` (inseam 5–35 cm, opening 40–100), `legOpening ≤ thigh`. Skirt
  checks: `SKIRT_RANGES`, `waist ≤ hips`, a length definition from `lengthDefinitions`
  (`waist | unknown`; tops can't use `waist`), `hipsBelowWaist` only on skirts, 5–30 cm and above
  every hem. `hemSweep` is a girth, last in `MEASUREMENT_KEYS`. Skirts and shorts take no photo
  landmarks yet (`landmarks: null`).
- Mannequin (skin rule): the body's waist (navel), hip line, crotch and knee are drawn at the body
  model's heights; leg widths come from its thigh / knee / calf (`halfWidth.leg`). Pants
  (`pantsShape`) draw the band at the fit engine's `bandHeight()` and the thigh, knee and
  opening from the chart; a missing one falls back to a typical width and draws dashed. Skirts
  (`skirtShape`) draw band, hip point and hem at `skirt.ts`'s heights, widths from waist / hips /
  sweep (A-line or pencil follows); without a sweep, straight from the hips, dashed.
  Framing is camera only: the Fitting room uses `frame="body"` (view ends under the feet, the
  figure fills the stage); elsewhere a fixed 214 cm canvas, so a taller body is drawn taller.
- Jackets (`templates/jacket.ts`) hang off the top under them: `envelopeGeometry` grows the body
  to the top's drawn side seam (and a long sleeve's room) plus `layerGrowCm` (bulk / 2π), down to
  that top's hem; `jacketShape` runs `topShape` on it with chest = body + `layerAllowanceCm` (what the
  fit compares), plus a placket and stand collar (drawn closed). The Mannequin draws `outer` last;
  under a jacket the top's arm overlay and pins give way to the jacket's. A longer top shows below.
- Leggings (`templates/leggings.ts`): skin-tight on the pants outline: the band at `bandHeight()`, the
  hem at `leggingsHemHeight()` (past the ankle bone it stops at the ankle, `pooled`), widths the body's
  own leg + `LEGGINGS_ROOM_CM` (0.2), the chart's only where it's bigger. Dashed only without an
  inseam. The drawn ankle (`y.ankle`) is the body model's ankle height.
- Dresses (`templates/dress.ts`): the bodice is `topShape` ended at the seam (`hemAt`: the chart
  waist's width there), the skirt `skirtOutline` from the seam to `dressHemHeight` (hips at the hip
  line, sweep from the chart; dashed without hips or sweep). Drawn bodice → skirt → arms → sleeves;
  `asUnder` carries the side seam down the skirt so a jacket hangs over it.
- Knits draw with `topShape` plus surface details: a rib hem band gathered to the chart's hem band
  (stretched onto the body where smaller, never wider than the body above; body width without one),
  rib cuffs, and for hoodies a hood behind the neck with drawcords. Length and a centre-back
  sleeve are placed with `tops.ts`. A snapshot of every tee and shirt drawing guards `topShape`.
- Photo landmarks per template: knits take the top's 13 plus an optional `hoodTop` (not warped yet);
  tops `TOP_LANDMARKS` (13), pants `PANTS_LANDMARKS` (14: waist
  corners + centre, hips, crotch, knee and hem corners per leg). Read them with `topLandmarks()` /
  `pantsLandmarks()`. Pants warp (`warpPantsPieces`) = the top half as two mirrored fans, each leg
  in strips along the drawn leg's edges (hip/crotch → knee → hem), as long sleeves are.
- Images: every image has a `licence` (`PHOTO_LICENCES`: own / brand-permission /
  affiliate-unaltered / local-only), or `npm run data:check` fails. Only own and brand-permission
  photos are warped onto the mannequin (`canWarp`); the rest draw in flat colour. Card thumbnails
  (`GarmentIcon`, `thumbPhotoSrc`) show own, brand-permission and affiliate-unaltered photos as they
  are (contained, never cropped), local-only never; the flat drawing otherwise or on a load error. `local-only`
  files never ship in the production build (`localOnlyFiles`). Today Gildan 5000 (Gildan's
  product image) and ryo-navy-graphic-tee (trademark logo) are local-only, and the other
  ryo- photos are own. Any other image must be committed under `app/public/`, not git-ignored,
  and at least `MIN_IMAGE_WIDTH_PX` (800) wide. The landmark picker keeps a photo's licence and
  starts a new photo local-only. Source photos in `photo-sources/` are never committed.
- Confidence grade (`gradeGarment`), checked in order: **unscored** (girth method or top
  length definition unknown) → **estimated** (any estimated value, a placeholder, or tier
  E–G) → **verified** (tier A–C, no warnings, audited) → **charted**.
- UI: cards show the grade badge (or "Sample data", development only); the readout footer gives source, date,
  tier in plain words and grade; estimated numbers get "est."; estimated garments draw with
  a faint dash.

## Commands
From the repo root:
```bash
npm install                # install the workspace (packages/core + app + mobile)
npm run check              # core, app, then mobile checks — gate every commit on this exiting 0
npm test -w @choudo/core   # core unit tests alone (the engine, golden tests, pure UI logic)
```
From `mobile/`:
```bash
npx expo start     # dev server + QR code: open it with the iPhone camera, runs in Expo Go
npm run check      # typecheck + Jest
npm run photos     # regenerate the bundled garment photo map (after a photo is added or re-licensed)
npm run fonts      # regenerate the Latin font subsets in assets/fonts/
npx expo install <pkg>  # add a package at the version SDK 58 expects
npx expo-doctor    # dependency and config checks (keep it at all checks passed)
```
From `app/`:
```bash
npm run dev        # dev server at http://localhost:5173 (also on your LAN for phones)
npm test           # app unit tests, once (core's run from the root)
npm run test:watch # app unit tests, watch mode
npm run check      # app only: typecheck + tests + data:check (the root check runs core too)
npm run data:check # garment data report: grade, warnings, errors, audit per garment
npm run dist:check # after npm run build: URLs under /Choudo/, only GoatCounter from elsewhere, sw.js, no dev pages or local-only photos
npm run fit:report # fit-test report from ../data/fit_tests.csv (or a path after --)
npm run photos     # cut garment photos out into public/garments/ (commit the PNG)
                   # then place landmarks at http://localhost:5173/dev/landmarks?id=<garment>
npm run icons      # favicon, Apple touch and manifest icons from the SVG masters in app/icons/, and the phone's (mobile/assets/images/)
npm run build      # typecheck + production build (base /Choudo/; vite preview serves it there)
```
CI and cloud sessions install from the repo root with `npm ci --ignore-scripts` then
`npm rebuild esbuild` (no install scripts, so `npm run photos` won't work there; nothing else
needs them).

## Deploy (GitHub Pages)
- Every push to `main` runs `.github/workflows/deploy-pages.yml` from the repo root: install,
  `npm run check` (core + app + mobile), `npm run build -w app`, `npm run dist:check -w app`, then deploy to https://yoshiryo2.github.io/Choudo/.
  Pages' source must be "GitHub Actions" (repo settings).
- Installable PWA: `public/manifest.webmanifest` uses relative URLs (works at `/` and `/Choudo/`).
  `public/sw.js` lets it open offline: the build stamps its `BUILD` line (`build/serviceWorker.ts`)
  with a per-build cache name and the files to precache (page, manifest, icons, code, woff2), and
  the worker deletes older caches. Pages load network-first; garment photos network-first, cached
  as viewed; everything else cache-first. `dist:check` fails on an unstamped worker.
- Dev-only, absent from the build: the landmark picker (dev server only) and Test mode
  (`ui/devTools.ts`; the panel and its switch are guarded by `import.meta.env.DEV` where drawn).
- local-only photos are never warped and are deleted from `dist/`; `dist:check` fails if one ships.
Logic that can be pure (geometry, form parsing, wording) lives in its own `.ts` file with
tests; components stay thin. localStorage keys are versioned (`choudo.body.v2`): bump the
version when a stored shape changes, and move old data in `ui-logic/state/migrate.ts` (runs once at
start-up). Keys today: `body` (v2: `bodyType`, optional `braSize`), `units`, `outfit` (v3, fitting
room: top, bottom, `outerId/outerSize` (a jacket slot never filled by default) and
`onepieceId/onepieceSize` (a dress: top and bottom stay null while it's worn)), `swipes` (one
`{garmentId, sizeShown, liked, at}` per garment), `folders`, `outfits` (v3, saved, with the jacket and dress slots), `anchor` (tee the user likes), `fitStyle`, `catalogue` (`matching` | `all`),
`testMode` (dev only), `fetched` (phone: garments read from pasted links, `{ product, fetchedAt }`,
newest first, max 30; also the 7-day cache), `unsupportedHosts` (phone, Test mode list, max 50), `fitTests` (v3, Test mode results with a `category`: tops record chest + length,
bottoms waist, thigh + inseam, jackets (`outer`) chest + sleeve with `wornOver`, dresses (`onepiece`)
chest + waist (when scored) + length; the CSV column stays
`sizing`, bottoms columns come last, then `worn_over`). Keys from
before the Choudo rename used the app's old prefix; `migrateAppRename` moves them over
(when both exist, the `choudo.*` key wins).

## Discover + Closet
- The Fitting room browses Top / Bottom / Dress / Jacket (Dress only when a dress is on show or
  worn; it opens on Dress when one is worn). A dress takes the place of the top and bottom; a top
  or bottom takes it off. A worn jacket's sizes, odds, hint and fit sheet are worked out over the
  top or dress, and its readout says "With your hoodie under it" plus layer notes.
- Navigation is a bottom `TabBar` (Fitting room / Discover / Closet) with plain state in
  `App.tsx`; the fitting-room outfit and the closet data live in `App` so any screen can
  put clothes on the mannequin.
- Discover feed (`buildFeed`): unseen garments in catalogue order, then passed ones oldest
  first; liked ones are left out, and only garments the catalogue toggle shows. The feed is
  fixed when the screen opens (or the toggle changes); at the end it says there are no more
  garments, offering Show all when the toggle hides some. Cards show the recommended size, or the middle size
  (labelled as such) when `recommendSize` returns null.
- Unliking a garment or deleting an outfit removes it from every folder.

## Working agreements
- Small steps, one commit per working piece; `npm run check` must pass before committing.
- If something is ambiguous, ask rather than guess.
