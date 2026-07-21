import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AuthClient, AuthEvent, AuthSession } from "./auth-client";
import { AuthProvider, useAuth } from "./AuthProvider";

function fakeClient(initial: AuthSession = null) {
  let listener: (event: AuthEvent, session: AuthSession) => void = () => undefined;
  const unsubscribe = vi.fn();
  const client: AuthClient = {
    getSession: vi.fn(async () => ({ session: initial, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return unsubscribe;
    }),
    signUp: vi.fn(async () => ({ session: null, error: null })),
    verifyEmailCode: vi.fn(async () => ({ session: null, error: null })),
    signIn: vi.fn(async () => ({ session: null, error: null })),
    requestPasswordReset: vi.fn(async () => ({ error: null })),
    updatePassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null }))
  };
  return { client, emit: (event: AuthEvent, session: AuthSession) => listener(event, session), unsubscribe };
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <output aria-label="auth-state">{JSON.stringify({
        configured: auth.configured,
        loading: auth.loading,
        user: auth.user,
        error: auth.error,
        notice: auth.notice,
        busy: auth.busy,
        recoveryMode: auth.recoveryMode,
        pendingVerificationEmail: auth.pendingVerificationEmail
      })}</output>
      <button onClick={() => auth.signIn("mateo@example.com", "password1")}>sign in</button>
      <button onClick={() => auth.signUp("mateo@example.com", "password1")}>sign up</button>
      <button onClick={() => auth.verifyEmailCode("mateo@example.com", "123456")}>verify email code</button>
      <button onClick={() => auth.requestPasswordReset("mateo@example.com")}>reset</button>
      <button onClick={() => auth.updatePassword("new-password1")}>update password</button>
      <button onClick={auth.signOut}>sign out</button>
    </div>
  );
}

function renderProvider(auth: ReturnType<typeof fakeClient>) {
  render(<AuthProvider client={auth.client} redirectTo="https://example.com/escalada/"><Probe /></AuthProvider>);
}

describe("AuthProvider", () => {
  it("loads the initial session and follows auth events", async () => {
    const auth = fakeClient({ user: { id: "user-1", email: "mateo@example.com" } });
    renderProvider(auth);

    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":true');
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"user-1"'));

    act(() => auth.emit("SIGNED_OUT", null));
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
    vi.mocked(auth.client.getSession).mockResolvedValue({ session: null, error: "unknown" });
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent("No pudimos verificar tu sesión"));
    expect(screen.getByLabelText("auth-state")).not.toHaveTextContent("unknown");
  });

  it("signs in with email and uses the returned session", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockResolvedValue({
      session: { user: { id: "user-2", email: "mateo@example.com" } },
      error: null
    });
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.click(screen.getByRole("button", { name: "sign in" }));

    expect(auth.client.signIn).toHaveBeenCalledWith("mateo@example.com", "password1");
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"user-2"');
  });

  it("shows email confirmation after signup without a session", async () => {
    const auth = fakeClient();
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.click(screen.getByRole("button", { name: "sign up" }));

    expect(auth.client.signUp).toHaveBeenCalledWith("mateo@example.com", "password1", "https://example.com/escalada/");
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("Revisa tu correo para obtener el código de seis dígitos");
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"pendingVerificationEmail":"mateo@example.com"');
  });

  it("verifies a pending email code and uses the returned session", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.verifyEmailCode).mockResolvedValue({
      session: { user: { id: "verified-user", email: "mateo@example.com" } },
      error: null
    });
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.click(screen.getByRole("button", { name: "sign up" }));
    await userEvent.click(screen.getByRole("button", { name: "verify email code" }));

    expect(auth.client.verifyEmailCode).toHaveBeenCalledWith("mateo@example.com", "123456");
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"verified-user"');
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"pendingVerificationEmail":null');
  });

  it("shows a non-enumerating reset notice", async () => {
    const auth = fakeClient();
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.click(screen.getByRole("button", { name: "reset" }));

    expect(auth.client.requestPasswordReset).toHaveBeenCalledWith("mateo@example.com", "https://example.com/escalada/");
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("Si existe una cuenta, recibirás un enlace");
  });

  it("keeps password reset non-enumerating when email delivery is rate limited", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.requestPasswordReset).mockResolvedValue({ error: "email_rate_limit" });
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.click(screen.getByRole("button", { name: "reset" }));

    expect(screen.getByLabelText("auth-state")).toHaveTextContent("Si existe una cuenta, recibirás un enlace");
    expect(screen.getByLabelText("auth-state")).not.toHaveTextContent("límite temporal");
  });

  it("enters recovery mode and exits after updating the password", async () => {
    const auth = fakeClient();
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    act(() => auth.emit("PASSWORD_RECOVERY", { user: { id: "user-1", email: "mateo@example.com" } }));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"recoveryMode":true');
    await userEvent.click(screen.getByRole("button", { name: "update password" }));

    expect(auth.client.updatePassword).toHaveBeenCalledWith("new-password1");
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"recoveryMode":false');
  });

  it("maps sign-in failures to Spanish without exposing provider details", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockResolvedValue({ session: null, error: "invalid_credentials" });
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.click(screen.getByRole("button", { name: "sign in" }));

    expect(screen.getByLabelText("auth-state")).toHaveTextContent("El correo o la contraseña no son correctos");
    expect(screen.getByLabelText("auth-state")).not.toHaveTextContent("invalid_credentials");
  });

  it("explains when the confirmation email service is temporarily full", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.signUp).mockResolvedValue({ session: null, error: "email_rate_limit" });
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.click(screen.getByRole("button", { name: "sign up" }));

    expect(screen.getByLabelText("auth-state")).toHaveTextContent("El servicio de correo alcanzó su límite temporal");
  });

  it("ignores a repeated action while the first is pending", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockReturnValue(new Promise(() => undefined));
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"loading":false'));

    await userEvent.dblClick(screen.getByRole("button", { name: "sign in" }));

    expect(auth.client.signIn).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"busy":true');
  });

  it("keeps the user when sign-out fails", async () => {
    const auth = fakeClient({ user: { id: "user-1", email: null } });
    vi.mocked(auth.client.signOut).mockResolvedValue({ error: "unknown" });
    renderProvider(auth);
    await waitFor(() => expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"user-1"'));
    await userEvent.click(screen.getByRole("button", { name: "sign out" }));
    expect(screen.getByLabelText("auth-state")).toHaveTextContent('"id":"user-1"');
    expect(screen.getByLabelText("auth-state")).toHaveTextContent("No pudimos cerrar sesión");
  });
});
