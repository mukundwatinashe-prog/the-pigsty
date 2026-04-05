/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_WHATSAPP_E164?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
