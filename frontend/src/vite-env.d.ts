/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_WHATSAPP_E164?: string;
  /** Same Web client ID as backend GOOGLE_CLIENT_ID (Google Cloud Console → APIs & Services → Credentials). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
