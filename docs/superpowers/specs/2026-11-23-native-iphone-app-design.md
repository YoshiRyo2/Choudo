# Choudo as a native iPhone app (Expo rewrite) — design

Date: 2026-11-23. Status: draft for Ryo's approval.

## Why
Choudo was always meant to be a phone app. Today it is a React + Vite web app (PWA on
GitHub Pages). We want it on the App Store as a real iPhone app that people find there
and that feels native. A wrapped website would risk Apple's Guideline 4.2 rejection ("not
sufficiently different from a mobile browsing experience"), and it would never feel like
an app built for the phone. We still want a web version, but it should come from the same
code, not be a second app to maintain.

## Goals
- A native iPhone app built with Expo (React Native) that does everything the site does
  today: Body, Anchor, Fitting room (mannequin, sizes, fit strip, Fit details), Discover
  (swipe + stamp), Closet (Liked / Folders / Outfits), About, and Test mode in development
  builds.
- Same fit results as the web, byte for byte. The fit engine is shared, not copied;
  `domain/fit/golden.test.ts` and `__golden__/` stay unchanged and keep passing.
- The playful look (`2026-11-22-playful-reskin-design.md`, screenshots in
  `2026-11-22-playful-reskin-screens/`) rebuilt with native parts: tab bar, form sheets,
  number pads, haptics, safe areas.
- Shipped to TestFlight, then submitted to the App Store.
- Afterwards, the website is the Expo web export of this same app, and the Vite UI is
  retired.

## Non-goals
- No new features, no change to fit logic, thresholds or verdict wording (those wait for
  the 10-person fit test).
- No accounts, backend, analytics, camera, AR or 3D. Guest-only; data stays on the phone.
- No Android store release (the code should stay Android-capable, but we don't test or
  ship it yet). No iPad layout. No dark mode in v1.

## Anti-goals (a failure even if it works)
- Fit results or body proportions that differ from the web app.
- An app that feels like a web page: browser-style scrolling bounce on fixed screens,
  pinch-zoom, tiny tap targets, web-style form fields.
- A Test mode or other hidden switch in the store build (Apple rejects hidden features).
- Showing local-only photos (Gildan 5000 product image, the Michelob Ultra tee) in a store
  or web build.

## Constraints
- Hard constraints from `CLAUDE.md` still apply: guest only, no face/photo/camera, the
  mannequin's proportions come only from the fit engine (drawing is a skin).
- Photo licences: only `own`, `brand-permission` and `affiliate-unaltered` photos ship;
  warping only for `own` and `brand-permission` (same rule as the web build's
  `leaveOutLocalPhotos`).
- Accessibility: text contrast ≥ 4.5:1, touch targets ≥ 44 pt, VoiceOver labels, Reduce
  Motion respected, Dynamic Type at least not breaking layouts.
- Ryo builds on a Mac (Apple silicon), so local Xcode builds are possible.
- The live site keeps working, unchanged, until the native app reaches parity.

## Approaches considered
1. **Wrap the existing web app with Capacitor.** Days of work, one codebase, but real 4.2
   rejection risk and never fully native. Rejected: Ryo wants a phone app first.
2. **Rebuild the interface in Expo, share the engine (chosen).** Weeks of work; most
   native; lowest review risk; web comes back via Expo's web export.
3. **Expo hosting the web screens (DOM components), then migrate.** More setup than 1 for
   the same first release; only worth it as a stepping stone. Rejected.

Ryo picked 2, with the full app (not a smaller first release) and the web kept.

## How it gets built

### Repo layout
```
packages/core/        shared, no React DOM, no React Native
  domain/             moved from app/src/domain (unchanged)
  ui-logic/           the pure helpers now in app/src/ui: Mannequin geometry.ts,
                      topShape.ts, photoWarp.ts, heads.ts, view.ts, templates/;
                      swipe.ts; stampGlyphs.ts; text helpers (fitText, catalogueText);
                      state logic (closet, feed, outfit, odds, fitTests, stampSeen,
                      stored, migrate); screen logic (bodyForm, bodyFieldErrors,
                      bodyPreview, anchorForm); small helpers (garmentThumb, sizeRow).
                      Kept at their app/src/ui sub-paths for now, so the move is pure
                      git mv. motion, focus and devTools stay in app/ (DOM / Vite only)
app/                  the current Vite site, now importing from packages/core
mobile/               the new Expo app
```
- About 5,900 lines of engine and 4,600 lines of pure UI helpers move once, with their
  tests (Vitest keeps running them). What gets rewritten is the TSX (~3,650 lines) and
  CSS.
- Step one is the move alone; the Vite app's `npm run check` and the golden tests must
  pass before anything else starts.

### The app
- Expo, latest stable SDK at build time, TypeScript, Expo Router.
- Navigation: native tabs Fitting room / Discover / Closet. Body and Anchor are a
  first-run flow (and reachable again from the Fitting room, as today). About and Fit
  details are native form sheets. Folder picker and confirmations are native
  sheets/menus.
- Styling: one theme file of tokens taken from today's CSS (peach `#ffb59e`, ink
  `#1b2433`, chalk fit colours, tape yellow, radii, spacing) and the colour roles in
  `app/src/ui/styles.css`. Font: M PLUS Rounded 1c via `expo-font`.
- Mannequin: `react-native-svg`, porting `Mannequin.tsx`, `MascotHead.tsx` and the height
  tape. The photo warp keeps its piecewise-affine method (one clipped, transformed image
  per triangle). If that isn't smooth when switching sizes on an iPhone 12-class phone,
  move the mannequin to `@shopify/react-native-skia`; the geometry stays the same.
- Discover: Gesture Handler + Reanimated for the swipe card, using the shared `swipe.ts`
  thresholds; `expo-haptics` on like/dislike and on the stamp landing.
- Body screen: number-pad keyboards, cm/in and kg/lb toggles, the same per-field checks
  on blur.
- Storage: a key-value adapter matching the `StorageLike` interface `migrate.ts` already
  accepts, backed by native app storage (not a web view), so data isn't wiped under
  storage pressure. Same `choudo.*` keys and migrations.
- Share an outfit: an outfit card from the Closet shared as an image through the iOS share
  sheet (`react-native-view-shot` + `expo-sharing`). This is the one small addition,
  because it is a clearly native touch for review and a free way for users to spread it.
- Test mode: only in development/preview builds (an `APP_VARIANT` check), never in the
  store build. CSV export goes through the share sheet.
- Portrait only, iPhone only, light appearance.

### Testing
- `packages/core`: Vitest as today, golden tests included.
- `mobile/`: `jest-expo` with React Native Testing Library for screens and components,
  plus screenshots from the iOS simulator compared side by side with
  `2026-11-22-playful-reskin-screens/` for each screen.

### Build and release
- EAS Build and EAS Submit (or a local Xcode build on Ryo's Mac), TestFlight first.
- App icon from `choudo-app-icon-1024.png`; splash on peach.
- App Store listing needs: privacy policy and support pages (hosted on the GitHub Pages
  site), App Privacy answer "Data Not Collected", age rating, 6.9" iPhone screenshots.

### Bringing the web back
- When the app reaches parity: change `deploy-pages.yml` to publish `expo export -p web`
  with base URL `/Choudo/`, check the site in Safari and Chrome, then delete the Vite UI
  (`app/src/ui`, `app/index.html` and the rest), keeping the scripts (data:check, photos,
  icons) wherever they now live.

## Order of work (one PR each)
1. Move shared code into `packages/core`; the Vite app imports it. No behaviour change.
2. Expo scaffold in `mobile/`: router, tabs, theme, font, storage adapter + migrations.
3. Body and Anchor screens.
4. Mannequin (drawing, heads, tape, photo warp).
5. Fitting room: carousel, size pills, fit strip, Fit details sheet.
6. Discover with swipe, haptics and the stamp.
7. Closet (Liked, Folders, Outfits) and outfit sharing.
8. About, Test mode (dev only), icon, splash, store build config, TestFlight.
9. Web export replaces the Vite site; Vite UI removed.

## Ryo's to-dos (no code)
- Enrol in the Apple Developer Program (99 USD a year; an individual account lists your
  legal name as the seller).
- Confirm the bundle ID before the first upload; it can't be changed afterwards.
  Proposed: `com.choudo.app`.
- Write (or approve a draft of) the privacy policy; App Store Connect app record.

## Left to the builder
- Exact libraries within the choices above, file layout inside `mobile/`, component
  breakdown, how the theme is organised, when to switch the mannequin to Skia (by the
  smoothness test above), workspace tooling for `packages/core`.
- My calls, open to Ryo's correction: the `packages/core` move; outfit sharing as the one
  addition; Test mode dev-only; iPhone-only, portrait, light mode; EAS for builds; bundle
  ID `com.choudo.app`.
