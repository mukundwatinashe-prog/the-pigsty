# Mobile apps (iOS & Android)

The Pigsty ships to the App Store and Play Store as **native shells around the
existing React web app**, using [Capacitor](https://capacitorjs.com). The web UI,
API, and business logic are shared 1:1 with the browser app — the native projects
live in `frontend/ios/` and `frontend/android/`.

## How it works

- `npm run build` produces the web bundle in `frontend/dist`.
- `cap sync` copies that bundle into the native projects and installs plugins.
- The native shell loads the bundled web app from a local origin
  (`capacitor://localhost` on iOS, `https://localhost` on Android) and calls the
  hosted API at `VITE_API_BASE_URL` (baked in at build time from
  `frontend/.env.production` → `https://api.the-pigsty.org/api`).

### Auth on native (important)

Inside a WebView, cross-site httpOnly cookies to the API are unreliable (iOS
blocks them), so the native app uses **Bearer tokens** instead of cookies. The web
app is unchanged and still uses cookies.

- The app sends `X-Client: mobile` on every request (`frontend/src/services/api.ts`).
- The API detects that header and returns `accessToken` + `refreshToken` in the
  JSON body on login/register/Google/MFA/refresh (`backend/src/controllers/auth.controller.ts`).
- Tokens are stored on-device with `@capacitor/preferences` and attached as
  `Authorization: Bearer …` (`frontend/src/lib/native.ts`).
- The API's CORS allowlist permits the native origins (`backend/src/server.ts`).

## Prerequisites (install on your machine)

These are **not** installed in CI or in this repo — you build the binaries locally.

**Android**
- [Android Studio](https://developer.android.com/studio) (bundles the SDK)
- JDK 17 (bundled with recent Android Studio)
- A Google Play Developer account ($25, one-time) to publish

**iOS** (macOS only)
- Xcode (from the Mac App Store)
- An Apple Developer account ($99/year) to publish
- Capacitor 8 uses Swift Package Manager, so CocoaPods is **not** required.

## Build & run

From `frontend/`:

```bash
# Rebuild the web app and push it into both native projects
npm run cap:sync

# Open Android Studio (Run ▶ to launch on an emulator/device)
npm run cap:android

# Open Xcode (set a Signing Team on the App target, then Run ▶)
npm run cap:ios
```

Re-run `npm run cap:sync` after any change to the web app.

## Store submission (high level)

1. Set app icons and splash screens (see `@capacitor/assets`).
2. **Android**: in Android Studio, Build → Generate Signed Bundle (AAB), then
   upload to the Play Console.
3. **iOS**: in Xcode, set your Team + bundle id (`org.thepigsty.app`), Product →
   Archive, then distribute to App Store Connect.

## Known gaps / decisions still needed

These were flagged during setup and are **not yet resolved**:

1. **Google Sign-In is hidden on native.** Google blocks OAuth in embedded
   WebViews, so `GoogleSignInButton` renders nothing in the app. To offer it,
   integrate a native plugin such as `@capacitor/google-auth` (or Sign in with
   Apple, which Apple requires if any third-party social login is present on iOS).
2. **In-app subscriptions vs. Apple/Google billing.** Apple (guideline 3.1.1) and
   Google require their in-app purchase systems for digital subscriptions bought
   inside the app — selling Grower/Enterprise via Stripe web checkout in-app risks
   rejection. Options: (a) use native IAP (RevenueCat is the common bridge),
   (b) make subscriptions web-only and don't surface upgrade UI in the app, or
   (c) ship the app read-only for billing. Decide before submitting to Apple.
3. **Push notifications / camera / deep links** are not wired up — add Capacitor
   plugins if needed.
4. **App icons & splash** are still the Capacitor defaults.

## Bundle identifier

`org.thepigsty.app` — change in `frontend/capacitor.config.ts` **and** the native
projects if you need a different id (must match your store listings).
