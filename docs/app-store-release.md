# Releasing Choudo on the App Store

Step by step, from no accounts to "Submitted for review". No code needed: every command runs
from a terminal in the repo, and each step says what success looks like. Do them in order;
steps 1 and 2 are once only.

What's already done in the code: the app's name (Choudo), bundle id (`com.choudo.app`, which
can't change once a build is uploaded), version 1.0.0, iPhone only, portrait, its icon and
splash, the encryption answer (none of its own), a privacy manifest (no tracking, no data
collected), the privacy policy and support pages on the website, and three build profiles in
`mobile/eas.json`.

## 1. Join the Apple Developer Program

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/) and enrol with
   your Apple ID (99 USD a year).
2. Enrol as an individual unless you have a company. An individual account lists your legal
   name as the seller on the App Store.
3. Wait for the approval email. It can take a day or two.

**Success:** [developer.apple.com/account](https://developer.apple.com/account) shows your
membership as active, and you can sign in to [App Store Connect](https://appstoreconnect.apple.com).

## 2. Set up Expo (EAS)

EAS is Expo's build service: it builds the iPhone app in the cloud, so you don't need Xcode.

1. Sign up at [expo.dev](https://expo.dev).
2. In a terminal, install the EAS command line tool and sign in:

   ```bash
   npm install -g eas-cli
   eas login
   ```

3. From the `mobile/` folder, link the app to your Expo account:

   ```bash
   cd mobile
   eas init
   ```

   This writes the project id into the app's config. Commit that change.

**Success:** `eas whoami` prints your Expo username, and the project shows up on expo.dev.

## 3. The first TestFlight build

1. From `mobile/`, build for the App Store:

   ```bash
   eas build -p ios --profile production
   ```

   The first time, EAS asks to sign in with your Apple ID and offers to create the signing
   certificate and provisioning profile: say yes to each. The build runs on Expo's servers;
   the terminal prints a link where you can watch it. It takes about 15–30 minutes.

2. When it finishes, send it to Apple:

   ```bash
   eas submit -p ios --latest
   ```

   The first time, it offers to create the app's record in App Store Connect: say yes.

Notes:

- The production profile numbers each build for you (`autoIncrement`), so you never edit
  build numbers by hand. To ship 1.0.1 later, change `version` in `mobile/app.json`.
- Expo's free plan has a monthly limit on cloud builds (see [expo.dev/pricing](https://expo.dev/pricing)).
  If you run out, you can build on your Mac instead: install Xcode from the Mac App Store,
  then run `npx expo run:ios --configuration Release` from `mobile/`.

**Success:** App Store Connect → your app → TestFlight lists the build. It shows "Processing"
for a few minutes first, then "Ready to Submit" (or asks you to answer the export compliance
question: the app uses no encryption of its own, which the config already says).

## 4. Try it on your iPhone with TestFlight

1. In App Store Connect → TestFlight → Internal Testing, create a group and add yourself and
   Derek (you each need to be users on the App Store Connect team: Users and Access → +).
2. Install the **TestFlight** app from the App Store on your iPhone.
3. Open the invitation email (or TestFlight itself) and install Choudo.

**Success:** Choudo is on your home screen with its own icon (the dress form on peach) and
opens on the peach splash.

## 5. Builds for the 10-person fit test

The fit test needs Test mode, which store builds never show. Use the preview profile:

```bash
eas build -p ios --profile preview
```

This is an internal build: EAS asks which iPhones may install it (each tester registers their
phone once by opening a link EAS gives you). When the build finishes, share its install link or
QR code with the testers.

In the app: Edit body → "For fit testers" → Test mode on. Results go out with **Export CSV**
(the share sheet: AirDrop or mail them to yourself) and are pasted into `data/fit_tests.csv`.

The `development` profile in `eas.json` is for a custom development build. You don't need it
while Expo Go works; if you ever do, run `npx expo install expo-dev-client` in `mobile/` first.

**Success:** a tester's phone shows the Test mode switch; a TestFlight or App Store build
doesn't.

## 6. The App Store listing

In App Store Connect → your app → the 1.0 version:

1. **Name:** Choudo. **Subtitle:** a short line, for example "See how each size fits you".
2. **Description** and **keywords:** what the app does in plain words (sizes compared with the
   brand's size chart, zone by zone; your measurements stay on your phone).
3. **Support URL:** `https://yoshiryo2.github.io/Choudo/support.html`
4. **Privacy policy URL:** `https://yoshiryo2.github.io/Choudo/privacy.html`
5. **App Privacy:** choose **Data Not Collected**. (True: nothing leaves the phone; see the
   privacy policy.)
6. **Age rating:** answer the questionnaire (no to everything applies).
7. **Category:** Shopping (or Lifestyle).
8. **Screenshots:** the 6.9-inch iPhone size is required. Take them on your iPhone from the
   TestFlight build (side button + volume up): the Fitting room, Discover, a Fit details sheet
   and the Closet make a good set.
9. Pick the build from step 3 under **Build**, then **Add for Review** → **Submit for Review**.

**Success:** the version's status reads "Waiting for Review". Review usually takes a day or
two; Apple emails you either way.

## 7. What review may ask, and the answers

- **"Why is there no sign-in?"** Choudo is guest-only by design: there are no accounts, and
  everything you enter stays on your phone.
- **"Where does the garment data come from?"** From each brand's published size chart. Every
  garment's Fit details names its source, with a link to the chart.
- **"Does the app collect data?"** No: no analytics, no tracking, nothing uploaded. The only
  things that leave the phone are what you choose to share (an outfit picture) and the brand
  size-chart links, which open in Safari.
