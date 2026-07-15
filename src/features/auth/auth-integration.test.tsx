import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppRoot } from "../../AppRoot";
import { defaultState } from "../../lib/training";
import { USER_DATA_STORAGE_KEY } from "../user-data/user-data-storage";
import type { AuthClient, AuthSession } from "./auth-client";

function fakeClient(initial: AuthSession) {
  let current = initial;
  let listener: (session: AuthSession) => void = () => undefined;
  const client: AuthClient = {
    getSession: vi.fn(async () => ({ session: current, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return () => undefined;
    }),
    signInWithApple: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => {
      current = null;
      listener(null);
      return { error: null };
    })
  };
  return {
    client,
    emit(session: AuthSession) {
      current = session;
      listener(session);
    }
  };
}

const configured = { url: "https://demo.supabase.co", publishableKey: "sb_publishable_demo" };

describe("Apple auth app integration", () => {
  beforeEach(() => localStorage.clear());

  it("does not load local user data while signed out", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify(defaultState));
    render(<AppRoot client={fakeClient(null).client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);
    expect(await screen.findByRole("button", { name: "Continuar con Apple" })).toBeInTheDocument();
    expect(localStorage.getItem(USER_DATA_STORAGE_KEY)).toBeNull();
  });

  it("claims existing local data and shows the Apple account", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({ ...defaultState, profile: { ...defaultState.profile, questionnaireCompleted: true } }));
    const auth = fakeClient({ user: { id: "apple-1", email: "mateo@example.com" } });
    render(<AppRoot client={auth.client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);

    expect(await screen.findByText("mateo@example.com")).toBeInTheDocument();
    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY)!);
      expect(envelope.users[envelope.activeUserId].identity.auth.subject).toBe("apple-1");
    });
  });

  it("creates a separate local record when the Apple subject changes", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({ ...defaultState, profile: { ...defaultState.profile, questionnaireCompleted: true } }));
    const auth = fakeClient({ user: { id: "apple-1", email: "first@example.com" } });
    render(<AppRoot client={auth.client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);
    await screen.findByText("first@example.com");

    act(() => auth.emit({ user: { id: "apple-2", email: "second@example.com" } }));
    await screen.findByText("second@example.com");
    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY)!);
      expect(Object.values(envelope.users).map((record: any) => record.identity.auth?.subject).sort()).toEqual(["apple-1", "apple-2"]);
    });
  });

  it("returns to the gate after sign-out", async () => {
    const auth = fakeClient({ user: { id: "apple-1", email: "mateo@example.com" } });
    render(<AppRoot client={auth.client} config={configured} origin="https://example.com" baseUrl="/escalada/" />);
    const buttons = await screen.findAllByRole("button", { name: "Cerrar sesión" });
    await userEvent.click(buttons[0]);
    expect(await screen.findByRole("button", { name: "Continuar con Apple" })).toBeInTheDocument();
  });
});
