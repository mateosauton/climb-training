import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "./AppRoot";
import { createSupabaseAuthClient } from "./features/auth/auth-client";
import { readAuthConfig } from "./features/auth/auth-config";
import { createE2EAuthClient } from "./features/auth/e2e-auth-client";
import { createCloudClient } from "./features/cloud/cloud-client";
import { createCloudRepository, type CloudQueryClient } from "./features/cloud/cloud-repository";
import { createE2ECloudRepository } from "./features/cloud/e2e-cloud-repository";
import { createCloudImport } from "./features/cloud/cloud-import";
import "./index.css";

const e2eUserId = import.meta.env.DEV ? import.meta.env.VITE_E2E_AUTH_USER_ID?.trim() : undefined;
const e2eSignedOut = Boolean(e2eUserId) && new URLSearchParams(window.location.search).get("e2e-auth") === "signed-out";
const authConfig = e2eUserId
  ? { url: "https://e2e.invalid", publishableKey: "e2e_publishable" }
  : readAuthConfig(import.meta.env);
const authClient = e2eUserId
  ? createE2EAuthClient(e2eUserId, import.meta.env.VITE_E2E_AUTH_EMAIL?.trim() || null, !e2eSignedOut)
  : authConfig ? createSupabaseAuthClient(authConfig) : null;
const cloudClient = e2eUserId ? null : createCloudClient(authConfig);
const cloudRepository = e2eSignedOut
  ? createE2ECloudRepository()
  : cloudClient ? createCloudRepository(cloudClient as unknown as CloudQueryClient) : null;
const cloudImport = cloudClient ? createCloudImport(cloudClient, localStorage) : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot
      client={authClient}
      config={authConfig}
      origin={window.location.origin}
      baseUrl={import.meta.env.BASE_URL}
      repository={cloudRepository}
      cloudImport={cloudImport}
      cloudAvatarClient={cloudClient}
    />
  </StrictMode>
);
