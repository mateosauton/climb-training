import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "./AppRoot";
import { createSupabaseAuthClient } from "./features/auth/auth-client";
import { readAuthConfig } from "./features/auth/auth-config";
import "./index.css";

const authConfig = readAuthConfig(import.meta.env);
const authClient = authConfig ? createSupabaseAuthClient(authConfig) : null;

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
