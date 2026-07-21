import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoot } from "../../AppRoot";
import { defaultState } from "../../lib/training";
import { USER_DATA_STORAGE_KEY } from "../user-data/user-data-storage";
import type { AuthClient, AuthEvent, AuthSession } from "./auth-client";

function fakeClient(initial: AuthSession) {
  let current = initial;
  let listener: (event: AuthEvent, session: AuthSession) => void = () => undefined;
  const client: AuthClient = {
    getSession: vi.fn(async () => ({ session: current, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return () => undefined;
    }),
    signUp: vi.fn(async () => ({ session: null, error: null })),
    verifyEmailCode: vi.fn(async () => ({ session: null, error: null })),
    signIn: vi.fn(async () => ({ session: null, error: null })),
    requestPasswordReset: vi.fn(async () => ({ error: null })),
    updatePassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => {
      current = null;
      listener("SIGNED_OUT", null);
      return { error: null };
    })
  };
  return {
    client,
    emit(session: AuthSession) {
      current = session;
      listener("SIGNED_IN", session);
    }
  };
}

const configured = { url: "https://demo.supabase.co", publishableKey: "sb_publishable_demo" };

describe("email auth app integration", () => {
  beforeEach(() => localStorage.clear());

  it("does not load local user data while signed out", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify(defaultState));
    render(<AppRoot client={fakeClient(null).client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);
    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(localStorage.getItem(USER_DATA_STORAGE_KEY)).toBeNull();
  });

  it("claims existing local data and shows the authenticated account", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({ ...defaultState, profile: { ...defaultState.profile, questionnaireCompleted: true } }));
    const auth = fakeClient({ user: { id: "user-1", email: "mateo@example.com" } });
    render(<AppRoot client={auth.client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);

    expect(await screen.findByText("mateo@example.com")).toBeInTheDocument();
    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY)!);
      expect(envelope.users[envelope.activeUserId].identity.auth.subject).toBe("user-1");
    });
  });

  it("uses a provider-neutral label when the account has no email", async () => {
    const auth = fakeClient({ user: { id: "user-1", email: null } });
    render(<AppRoot client={auth.client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);

    expect((await screen.findAllByText("Cuenta Supabase")).length).toBeGreaterThan(0);
  });

  it("creates a separate local record when the Supabase subject changes", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({ ...defaultState, profile: { ...defaultState.profile, questionnaireCompleted: true } }));
    const auth = fakeClient({ user: { id: "user-1", email: "first@example.com" } });
    render(<AppRoot client={auth.client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);
    await screen.findByText("first@example.com");

    act(() => auth.emit({ user: { id: "user-2", email: "second@example.com" } }));
    await screen.findByText("second@example.com");
    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY)!);
      expect(Object.values(envelope.users).map((record: any) => record.identity.auth?.subject).sort()).toEqual(["user-1", "user-2"]);
    });
  });

  it("returns to the gate after sign-out", async () => {
    const auth = fakeClient({ user: { id: "user-1", email: "mateo@example.com" } });
    render(<AppRoot client={auth.client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);
    const buttons = await screen.findAllByRole("button", { name: "Cerrar sesión" });
    await userEvent.click(buttons[0]);
    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });
});
