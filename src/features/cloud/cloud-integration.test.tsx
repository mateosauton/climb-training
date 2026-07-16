import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppRoot } from "../../AppRoot";
import App from "../../App";
import type { AuthClient, AuthSession } from "../auth/auth-client";
import type { CloudRepository } from "./cloud-repository";
import type { CloudImport } from "./cloud-import";
import { migrateLegacyUserData } from "../user-data/user-data-migration";
import { defaultState } from "../../lib/training";
import { USER_DATA_STORAGE_KEY } from "../user-data/user-data-storage";

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
    hydrate: vi.fn(async () => ({ facts: [], sessionLogs: [], guided: { schemaVersion: 1, activeRun: null, history: [] }, activePlan: null })),
    submitQuestionnaire: vi.fn(async () => undefined),
    appendFacts: vi.fn(async () => undefined),
    saveGuidedState: vi.fn(async () => undefined),
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

  it("offers every valid v3 recovery envelope for an idempotent cloud import", async () => {
    let id = 0;
    const envelope = migrateLegacyUserData({ tracker: structuredClone(defaultState), guided: { schemaVersion: 1, activeRun: null, history: [] }, now: "2026-07-15T00:00:00.000Z", makeId: () => `id-${++id}` });
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(envelope));
    const importer: CloudImport = { import: vi.fn().mockRejectedValue({ code: "import_unavailable" }) };
    render(<App cloudImport={importer} />);

    expect(await screen.findByText("Importación pendiente")).toBeInTheDocument();
    const original = localStorage.getItem(USER_DATA_STORAGE_KEY);
    await screen.findByRole("button", { name: "Importar datos locales" }).then((button) => button.click());
    expect(await screen.findByText("No pudimos importar tus datos")).toBeInTheDocument();
    expect(localStorage.getItem(USER_DATA_STORAGE_KEY)).toBe(original);
    await screen.findByRole("button", { name: "Reintentar importación" }).then((button) => button.click());
    await waitFor(() => expect(importer.import).toHaveBeenCalledTimes(2));
  });

  it("completes a recovery import with no legacy videos without staging uploads", async () => {
    let id = 0;
    const envelope = migrateLegacyUserData({ tracker: structuredClone(defaultState), guided: { schemaVersion: 1, activeRun: null, history: [] }, now: "2026-07-15T00:00:00.000Z", makeId: () => `id-${++id}` });
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(envelope));
    const importer: CloudImport = { import: vi.fn(async () => ({ status: "completed" as const, receiptId: "receipt-1", pendingVideoIds: [] })) };
    const uploadLegacyVideo = vi.fn();

    render(<App cloudImport={importer} uploadLegacyVideo={uploadLegacyVideo} />);
    await screen.findByRole("button", { name: "Importar datos locales" }).then((button) => button.click());

    await waitFor(() => expect(importer.import).toHaveBeenCalledTimes(1));
    expect(uploadLegacyVideo).not.toHaveBeenCalled();
    expect(screen.queryByText("Importación pendiente")).not.toBeInTheDocument();
  });

  it("stages legacy IndexedDB videos by receipt ID before completing their import", async () => {
    let id = 0;
    const envelope = migrateLegacyUserData({ tracker: structuredClone(defaultState), guided: { schemaVersion: 1, activeRun: null, history: [] }, now: "2026-07-15T00:00:00.000Z", makeId: () => `id-${++id}` });
    envelope.users[envelope.activeUserId].videoAnalyses.push({ id: "video-1", sessionId: "w1d1", createdAt: "2026-07-15T00:00:00.000Z", fileName: "attempt.mp4", duration: 12, size: 4, notes: "", footCuts: 0, swing: 0, hips: 0, shoulder: 0, breath: 0, reading: 0, advice: [] });
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(envelope));
    const importer: CloudImport = { import: vi.fn()
      .mockResolvedValueOnce({ status: "metadata_imported", receiptId: "receipt-1", pendingVideoIds: ["video-1"] })
      .mockResolvedValueOnce({ status: "completed", receiptId: "receipt-1", pendingVideoIds: [] }) };
    const loadLegacyVideoBlob = vi.fn(async () => new Blob(["clip"], { type: "video/mp4" }));
    const uploadLegacyVideo = vi.fn(async () => ({ videoId: "video-1", path: "athlete-1/video-1/original.mp4" }));

    render(<App cloudImport={importer} loadLegacyVideoBlob={loadLegacyVideoBlob} uploadLegacyVideo={uploadLegacyVideo} />);
    await screen.findByRole("button", { name: "Importar datos locales" }).then((button) => button.click());

    await waitFor(() => expect(importer.import).toHaveBeenCalledTimes(2));
    expect(loadLegacyVideoBlob).toHaveBeenCalledWith("video-1");
    expect(uploadLegacyVideo).toHaveBeenCalledWith(expect.objectContaining({ name: "attempt.mp4" }), { videoId: "video-1", durationSeconds: 12 });
    expect(importer.import).toHaveBeenLastCalledWith(expect.any(Object), ["video-1"]);
  });

  it("retains a retry action when a legacy staged video is unavailable", async () => {
    let id = 0;
    const envelope = migrateLegacyUserData({ tracker: structuredClone(defaultState), guided: { schemaVersion: 1, activeRun: null, history: [] }, now: "2026-07-15T00:00:00.000Z", makeId: () => `id-${++id}` });
    envelope.users[envelope.activeUserId].videoAnalyses.push({ id: "video-1", sessionId: "w1d1", createdAt: "2026-07-15T00:00:00.000Z", fileName: "attempt.mp4", duration: 12, size: 4, notes: "", footCuts: 0, swing: 0, hips: 0, shoulder: 0, breath: 0, reading: 0, advice: [] });
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(envelope));
    const importer: CloudImport = { import: vi.fn(async () => ({ status: "metadata_imported" as const, receiptId: "receipt-1", pendingVideoIds: ["video-1"] })) };

    render(<App cloudImport={importer} loadLegacyVideoBlob={async () => undefined} uploadLegacyVideo={vi.fn()} />);
    await screen.findByRole("button", { name: "Importar datos locales" }).then((button) => button.click());

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos importar tus datos");
    expect(screen.getByRole("button", { name: "Reintentar importación" })).toBeInTheDocument();
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

  it("hydrates facts and activity from cloud state instead of local recovery on reload", async () => {
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify({ invalid: "recovery must not win" }));
    const hydrate = vi.fn(async () => ({
      facts: [
        { id: "fact-1", fact_key: "name", value: "Cloud Mateo", source: { type: "import", field: "name", version: 1 }, created_at: "2026-07-15T00:00:00.000Z" },
        { id: "fact-2", fact_key: "questionnaireCompleted", value: true, source: { type: "import", field: "questionnaireCompleted", version: 1 }, created_at: "2026-07-15T00:00:00.000Z" }
      ],
      sessionLogs: [{ id: "log-1", metrics: { sessionId: "w1d1", attempts: 4, moves: 10, bestLink: 3, footCuts: 0, pullWeight: 0, sleep: 7 }, rpe: 7, pump: 5, pain: 1, energy: 8, body: "cloud", created_at: "2026-07-15T00:00:00.000Z" }],
      guided: { schemaVersion: 1, activeRun: null, history: [] }, activePlan: { id: "plan-1" }
    }));
    const cloud = { ...repository(vi.fn(async () => undefined)), hydrate };
    render(<App cloudRepository={cloud} cloudVerified cloudHydration={await hydrate()} />);
    await userEvent.setup().click(screen.getAllByRole("tab", { name: "Perfil" })[0]);
    expect(await screen.findByText("Cloud Mateo")).toBeInTheDocument();
  });

  it("sends profile facts and logs to cloud with stable retry keys", async () => {
    const user = userEvent.setup();
    const appendFacts = vi.fn(async () => undefined);
    const appendSessionLog = vi.fn(async () => undefined);
    const cloud = { ...repository(vi.fn(async () => undefined)), appendFacts, appendSessionLog };
    localStorage.setItem("climb4w.state.v1", JSON.stringify({ ...defaultState, profile: { ...defaultState.profile, questionnaireCompleted: true } }));
    render(<App cloudRepository={cloud} />);
    await user.click(screen.getAllByRole("tab", { name: "Perfil" })[0]);
    fireEvent.change(await screen.findByLabelText("Grado actual"), { target: { value: "7c" } });
    await user.click(screen.getByRole("button", { name: "Guardar objetivos" }));
    await waitFor(() => expect(appendFacts).toHaveBeenCalled());
    await user.click(screen.getAllByRole("tab", { name: "Log" })[0]);
    await user.click(screen.getByRole("button", { name: "Guardar log" }));
    await waitFor(() => expect(appendSessionLog).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: expect.any(String) })));
  });
});
