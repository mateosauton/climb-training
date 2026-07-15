import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "./AppRoot";
import { createSupabaseAuthClient } from "./features/auth/auth-client";
import { readAuthConfig } from "./features/auth/auth-config";
import { createE2EAuthClient } from "./features/auth/e2e-auth-client";
import "./index.css";

const e2eUserId = import.meta.env.DEV ? import.meta.env.VITE_E2E_AUTH_USER_ID?.trim() : undefined;
const authConfig = e2eUserId
  ? { url: "https://e2e.invalid", publishableKey: "e2e_publishable" }
  : readAuthConfig(import.meta.env);
const authClient = e2eUserId
  ? createE2EAuthClient(e2eUserId, import.meta.env.VITE_E2E_AUTH_EMAIL?.trim() || null)
  : authConfig ? createSupabaseAuthClient(authConfig) : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot
      client={authClient}
      config={authConfig}
      origin={window.location.origin}
      baseUrl={import.meta.env.BASE_URL}
    />
  </StrictMode>
);
