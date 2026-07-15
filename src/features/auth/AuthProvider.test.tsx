import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AuthClient, AuthSession } from "./auth-client";
import { AuthProvider, useAuth } from "./AuthProvider";

function fakeClient(initial: AuthSession = null) {
  let listener: (session: AuthSession) => void = () => undefined;
  const unsubscribe = vi.fn();
  const client: AuthClient = {
    getSession: vi.fn(async () => ({ session: initial, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return unsubscribe;
    }),
    signInWithApple: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null }))
  };
  return { client, emit: (session: AuthSession) => listener(session), unsubscribe };
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <output aria-label="auth-state">{JSON.stringify({ configured: auth.configured, loading: auth.loading, user: auth.user, error: auth.error })}</output>
      <button onClick={auth.signInWithApple}>sign in</button>
      <button onClick={auth.signOut}>sign out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  it("loads the initial session and follows auth events", async () => {
    const auth = fakeClient({ user: { id: "apple-1", email: "mateo@example.com" } });
    render(<AuthProvider client={auth.client} redirectTo="https://example.com/escalada/"><Probe /></AuthProvider>);

    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":true');
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"apple-1"'));

    act(() => auth.emit(null));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"user":null');
  });

  it("unsubscribes on unmount", async () => {
    const auth = fakeClient();
    const view = render(<AuthProvider client={auth.client} redirectTo="https://example.com/"><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));
    view.unmount();
    expect(auth.unsubscribe).toHaveBeenCalledOnce();
  });

  it("reports a generic initial-session error", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.getSession).mockResolvedValue({ session: null, error: "token payload" });
    render(<AuthProvider client={auth.client} redirectTo="https://example.com/"><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("No pudimos verificar tu sesión"));
    expect(screen.getByLabelText("auth-state")).not.toHaveTextContent("token payload");
  });

  it("keeps the user when sign-out fails", async () => {
    const auth = fakeClient({ user: { id: "apple-1", email: null } });
    vi.mocked(auth.client.signOut).mockResolvedValue({ error: "provider details" });
    render(<AuthProvider client={auth.client} redirectTo="https://example.com/"><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"apple-1"'));
    await userEvent.click(screen.getByRole("button", { name: "sign out" }));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"apple-1"');
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("No pudimos cerrar sesión");
  });

  it("starts Apple OAuth with the configured redirect", async () => {
    const auth = fakeClient();
    render(<AuthProvider client={auth.client} redirectTo="https://example.com/escalada/"><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));
    await userEvent.click(screen.getByRole("button", { name: "sign in" }));
    expect(auth.client.signInWithApple).toHaveBeenCalledWith("https://example.com/escalada/");
  });
});
