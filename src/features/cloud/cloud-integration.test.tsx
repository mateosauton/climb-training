import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppRoot } from "../../AppRoot";
import App from "../../App";
import type { AuthClient, AuthSession } from "../auth/auth-client";
import type { CloudRepository } from "./cloud-repository";
import type { CloudImport } from "./cloud-import";

const configured = { url: "https://demo.supabase.co", publishableKey: "sb_publishable_demo" };

function authenticatedClient(session: AuthSession): AuthClient {
  return {
    getSession: vi.fn(async () => ({ session, error: null })),
    onAuthStateChange: vi.fn(() => () => undefined),
    signUp: vi.fn(async () => ({ session: null, error: null })),
    signIn: vi.fn(async () => ({ session: null, error: null })),
    requestPasswordReset: vi.fn(async () => ({ error: null })),
    updatePassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null }))
  };
}

function repository(ensureProfile: CloudRepository["ensureProfile"]): CloudRepository {
  return {
    ensureProfile,
    submitQuestionnaire: vi.fn(async () => undefined),
    listActivePlan: vi.fn(async () => null),
    startSessionRun: vi.fn(async () => undefined),
    appendSessionLog: vi.fn(async () => undefined)
  };
}

describe("cloud-primary app integration", () => {
  it("does not initialize cloud data for a signed-out visitor", async () => {
    const ensureProfile = vi.fn(async () => undefined);
    render(<AppRoot client={authenticatedClient(null)} config={configured} origin="https://example.com" baseUrl="/" repository={repository(ensureProfile)} />);

    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it("waits for the authenticated cloud profile before rendering tracker data", async () => {
    let resolveProfile: (() => void) | undefined;
    const ensureProfile = vi.fn(() => new Promise<void>((resolve) => { resolveProfile = resolve; }));
    render(<AppRoot client={authenticatedClient({ user: { id: "athlete-1", email: "mateo@example.com" } })} config={configured} origin="https://example.com" baseUrl="/" repository={repository(ensureProfile)} />);

    expect(await screen.findByText("Preparando tus datos en la nube…")).toBeInTheDocument();
    expect(screen.queryByText("mateo@example.com")).not.toBeInTheDocument();
    resolveProfile?.();
    expect(await screen.findByText("mateo@example.com")).toBeInTheDocument();
    expect(ensureProfile).toHaveBeenCalledTimes(1);
  });

  it("keeps the tracker unavailable after a cloud failure and offers a Spanish retry", async () => {
    const ensureProfile = vi.fn()
      .mockRejectedValueOnce({ code: "unavailable" })
      .mockResolvedValueOnce(undefined);
    render(<AppRoot client={authenticatedClient({ user: { id: "athlete-1", email: "mateo@example.com" } })} config={configured} origin="https://example.com" baseUrl="/" repository={repository(ensureProfile)} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos preparar tus datos en la nube");
    await screen.findByRole("button", { name: "Reintentar" }).then((button) => button.click());
    await waitFor(() => expect(ensureProfile).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("mateo@example.com")).toBeInTheDocument();
  });

  it("keeps local recovery data when a cloud import fails and lets the athlete retry", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({ profile: { name: "Mateo" }, goals: {}, logs: [], videos: [] }));
    const importer: CloudImport = { import: vi.fn().mockRejectedValue({ code: "import_unavailable" }) };
    render(<App cloudImport={importer} />);

    expect(await screen.findByText("Importación pendiente")).toBeInTheDocument();
    const original = localStorage.getItem("climb4w.state.v1");
    await screen.findByRole("button", { name: "Importar datos locales" }).then((button) => button.click());
    expect(await screen.findByText("No pudimos importar tus datos")).toBeInTheDocument();
    expect(localStorage.getItem("climb4w.state.v1")).toBe(original);
    await screen.findByRole("button", { name: "Reintentar importación" }).then((button) => button.click());
    await waitFor(() => expect(importer.import).toHaveBeenCalledTimes(2));
  });

  it("writes a questionnaire to the cloud with a retry-safe key after saving recovery data", async () => {
    let submitted: Parameters<CloudRepository["submitQuestionnaire"]>[0] | null = null;
    const submitQuestionnaire = vi.fn(async (input: Parameters<CloudRepository["submitQuestionnaire"]>[0]) => { submitted = input; });
    const cloud = { ...repository(vi.fn(async () => undefined)), submitQuestionnaire };
    render(<App cloudRepository={cloud} />);

    await screen.findByRole("button", { name: /^6\./ }).then((button) => button.click());
    await screen.findByRole("button", { name: "Guardar cuestionario" }).then((button) => button.click());
    await waitFor(() => expect(submitQuestionnaire).toHaveBeenCalledTimes(1));
    expect(submitted).toMatchObject({ version: 2, idempotencyKey: expect.any(String) });
  });
});
