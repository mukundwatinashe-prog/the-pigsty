/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Production API base (e.g. https://api.the-pigsty.org/api). Defaults to /api. */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_WHATSAPP_E164?: string;
  /** Same Web client ID as backend GOOGLE_CLIENT_ID (Google Cloud Console → APIs & Services → Credentials). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** iOS OAuth client ID for native Google Sign-In (@capgo/capacitor-social-login). */
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string;
  /** Cloudflare Turnstile site key — required in production for chat human verification. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Sentry DSN for frontend error monitoring. Empty disables Sentry. */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
