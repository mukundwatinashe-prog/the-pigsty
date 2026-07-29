# Native Google Sign-In (Android & iOS)

The website uses Google Identity Services (the web button). Google **blocks OAuth
inside embedded WebViews**, so the native apps use a **native** sign-in flow via
[`@capgo/capacitor-social-login`](https://github.com/Cap-go/capacitor-social-login).
It returns a Google **ID token** which the backend verifies at `POST /api/auth/google`
— the same endpoint the website uses. No backend changes are needed.

The app code is already wired (`frontend/src/components/GoogleSignInButton.tsx`).
What's left is **Google Cloud config + a native rebuild**, which must be done with
your Google Cloud account and Android Studio / Xcode.

---

## 1. Get your app's signing SHA-1 (Android)

Google matches the Android OAuth client by **package name + SHA-1 fingerprint**.

- **Debug builds** (for testing the dev/test app):
  ```bash
  cd frontend/android
  ./gradlew signingReport
  ```
  Copy the **SHA1** under `Variant: debug` (a colon-separated hex string).
- **Release / Play Store builds:** use the SHA-1 of your **upload key**, and — once
  the app is on Play — also add the **App Signing key** SHA-1 from
  Play Console → your app → *Setup → App signing*.

## 2. Create OAuth clients in Google Cloud Console

Go to **console.cloud.google.com → APIs & Services → Credentials**, in the **same
project** that owns your Web client (`556349279611-…apps.googleusercontent.com`).

- **Create Credentials → OAuth client ID → Android**
  - Package name: `org.thepigsty.app`
  - SHA-1: the fingerprint(s) from step 1 (add both debug and release)
- **Create Credentials → OAuth client ID → iOS**
  - Bundle ID: `org.thepigsty.app`
  - Note the generated **iOS client ID** (`…apps.googleusercontent.com`)

> You do **not** pass the Android client ID anywhere in code — Google matches it by
> package + SHA-1. You **do** need the iOS client ID (next step). The **Web** client
> ID stays as-is; the native flow requests an ID token whose audience is the Web
> client ID so the backend verification is unchanged.

## 3. Configure the iOS client ID for the build

Add to `frontend/.env.production` (baked into the native build):
```
VITE_GOOGLE_IOS_CLIENT_ID=<your-iOS-client-id>.apps.googleusercontent.com
```

## 4. iOS URL scheme

In Xcode → your target → **Info → URL Types**, add a URL scheme equal to your iOS
client ID **reversed** (i.e. `com.googleusercontent.apps.<...>`). This is what
Google redirects back to after sign-in. (`@capgo/capacitor-social-login`'s README
has the exact snippet.)

## 5. Build & sync

```bash
cd frontend
npm install            # picks up @capgo/capacitor-social-login (already in package.json)
npm run build
npx cap sync android
npx cap sync ios
```

## 6. Rebuild & test

- **Android Studio:** rebuild, run on a device/emulator with a Google account, tap
  **Continue with Google**.
- **Xcode:** rebuild, run, tap the button.

---

## Notes & troubleshooting

- **Apple requirement:** if you offer Google (a third-party sign-in) on iOS, the
  App Store **requires** you also offer **Sign in with Apple**. `@capgo/
  capacitor-social-login` supports Apple too — add it before the next iOS submission.
- **Android "Error 10" / `DEVELOPER_ERROR`:** the SHA-1 or package name in the
  Android OAuth client doesn't match the build you're running. Re-check step 1/2
  (remember debug vs release keys are different).
- **"idToken is null":** make sure `webClientId` (the **Web** client ID) is set —
  the native SDK needs it to return an ID token, not just an access token.
- Nothing here affects the **website** — the web Google button is unchanged.
