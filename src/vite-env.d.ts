/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_E2E_AUTH_USER_ID?: string;
  readonly VITE_E2E_AUTH_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
