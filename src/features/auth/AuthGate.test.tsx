import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AuthClient, AuthEvent, AuthSession } from "./auth-client";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthProvider";

function fakeClient(session: AuthSession = null) {
  let listener: (event: AuthEvent, next: AuthSession) => void = () => undefined;
  const client: AuthClient = {
    getSession: vi.fn(async () => ({ session, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return () => undefined;
    }),
    signUp: vi.fn(async () => ({ session: null, error: null })),
    verifyEmailCode: vi.fn(async () => ({ session: null, error: null })),
    signIn: vi.fn(async () => ({ session: null, error: null })),
    requestPasswordReset: vi.fn(async () => ({ error: null })),
    updatePassword: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null }))
  };
  return { client, emit: (event: AuthEvent, next: AuthSession) => listener(event, next) };
}

function renderGate(authClient: AuthClient | null) {
  render(
    <AuthProvider client={authClient} redirectTo="https://example.com/escalada/">
      <AuthGate>{(user) => <div>tracker for {user.id}</div>}</AuthGate>
    </AuthProvider>
  );
}

describe("AuthGate", () => {
  it("does not render tracker while the session loads", () => {
    const auth = fakeClient();
    vi.mocked(auth.client.getSession).mockReturnValue(new Promise(() => undefined));
    renderGate(auth.client);
    expect(screen.getByText("Verificando tu sesión…")).toBeInTheDocument();
    expect(screen.queryByText(/tracker for/)).not.toBeInTheDocument();
  });

  it("shows provider-neutral setup guidance when configuration is missing", async () => {
    renderGate(null);
    expect(await screen.findByRole("heading", { name: "Configura el acceso por correo" })).toBeInTheDocument();
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument();
    expect(screen.queryByText(/tracker for/)).not.toBeInTheDocument();
  });

  it("signs in with email and password", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo electrónico"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(auth.client.signIn).toHaveBeenCalledWith("mateo@example.com", "password1");
  });

  it("creates an account then verifies a six-digit email code", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.verifyEmailCode).mockResolvedValue({
      session: { user: { id: "verified-user", email: "mateo@example.com" } },
      error: null
    });
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Crear cuenta" }));
    await user.type(screen.getByLabelText("Correo electrónico"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Registrarme" }));

    expect(auth.client.signUp).toHaveBeenCalledWith("mateo@example.com", "password1", "https://example.com/escalada/");
    expect(await screen.findByText("Revisa tu correo para obtener el código de seis dígitos.")).toBeInTheDocument();
    const code = screen.getByLabelText("Código de verificación");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("maxlength", "6");

    await user.type(code, "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar código" }));

    expect(auth.client.verifyEmailCode).toHaveBeenCalledWith("mateo@example.com", "123456");
    expect(await screen.findByText("tracker for verified-user")).toBeInTheDocument();
  });

  it.each([
    ["short", "short", "La contraseña debe tener al menos 8 caracteres."],
    ["password1", "password2", "Las contraseñas no coinciden."]
  ])("validates signup passwords before submission", async (password, confirmation, message) => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Crear cuenta" }));
    await user.type(screen.getByLabelText("Correo electrónico"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), password);
    await user.type(screen.getByLabelText("Confirmar contraseña"), confirmation);
    await user.click(screen.getByRole("button", { name: "Registrarme" }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(auth.client.signUp).not.toHaveBeenCalled();
  });

  it("requests a password reset without revealing account existence", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Olvidé mi contraseña" }));
    await user.type(screen.getByLabelText("Correo electrónico"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(auth.client.requestPasswordReset).toHaveBeenCalledWith("mateo@example.com", "https://example.com/escalada/");
    expect(await screen.findByText(/Si existe una cuenta, recibirás un enlace/)).toBeInTheDocument();
  });

  it("updates the password from a recovery session", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    await screen.findByRole("button", { name: "Iniciar sesión" });

    act(() => auth.emit("PASSWORD_RECOVERY", { user: { id: "user-1", email: "mateo@example.com" } }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nueva contraseña"), "new-password1");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "new-password1");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(auth.client.updatePassword).toHaveBeenCalledWith("new-password1");
    expect(await screen.findByText("tracker for user-1")).toBeInTheDocument();
  });

  it("shows sanitized authentication errors", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockResolvedValue({ session: null, error: "invalid_credentials" });
    renderGate(auth.client);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo electrónico"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El correo o la contraseña no son correctos");
    expect(screen.getByRole("alert")).not.toHaveTextContent("invalid_credentials");
  });

  it("renders authenticated children", async () => {
    renderGate(fakeClient({ user: { id: "user-1", email: "mateo@example.com" } }).client);
    await waitFor(() => expect(screen.getByText("tracker for user-1")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Iniciar sesión" })).not.toBeInTheDocument();
  });
});
