import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    resendConfirmation: vi.fn(async () => ({ error: null })),
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
  beforeEach(() => {
    window.history.replaceState(null, "", "/escalada/login");
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

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

  it("shows Maillon login copy on the dusty gate", async () => {
    renderGate(fakeClient().client);
    expect(await screen.findByRole("heading", { name: "Maillon" })).toBeInTheDocument();
    expect(screen.getByText("Inicia sesión para ver tu plan y guardar tus sesiones en tu cuenta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toBeInTheDocument();
    expect(screen.getByText("¿No tienes cuenta?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Tus sesiones se guardan en este dispositivo y se sincronizan con tu cuenta.")).toBeInTheDocument();
    expect(screen.queryByText(/Escalada 4W|permanecen en este dispositivo|registros locales/)).not.toBeInTheDocument();
    expect(document.querySelector(".auth-gate")).toHaveClass("auth-gate");
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toHaveClass("auth-primary");

    const email = screen.getByLabelText("Correo");
    const password = screen.getByLabelText("Contraseña");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(email).toHaveClass("auth-input");
  });

  it("signs in with email and password", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(auth.client.signIn).toHaveBeenCalledWith("mateo@example.com", "password1");
  });

  it("toggles password visibility", async () => {
    renderGate(fakeClient().client);
    const user = userEvent.setup();
    const password = await screen.findByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toBeInTheDocument();
  });

  it("creates an account then verifies a six-digit email code", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.verifyEmailCode).mockResolvedValue({
      session: { user: { id: "verified-user", email: "mateo@example.com" } },
      error: null
    });
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: "Crear cuenta" }));
    expect(await screen.findByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Guarda tu plan y tus sesiones, y úsalos en cualquier dispositivo.")).toBeInTheDocument();
    expect(screen.getByText("Mínimo 8 caracteres.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Términos" })).toHaveAttribute("href", "/escalada/terminos");
    expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/escalada/privacidad");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("autocomplete", "new-password");

    await user.type(screen.getByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

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

  it("keeps a short signup password from being submitted", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: "Crear cuenta" }));
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "short");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByText("Mínimo 8 caracteres.")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "true");
    expect(auth.client.signUp).not.toHaveBeenCalled();
  });

  it("requests a password reset without revealing account existence", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: "¿Olvidaste tu contraseña?" }));
    expect(await screen.findByRole("heading", { name: "Recupera tu acceso" })).toBeInTheDocument();
    expect(screen.getByText("Te enviaremos un enlace para crear una nueva contraseña.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Correo"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(auth.client.requestPasswordReset).toHaveBeenCalledWith("mateo@example.com", "https://example.com/escalada/reset/nueva");
    expect(await screen.findByText("Si hay una cuenta con ese correo, te enviamos un enlace. Revisa también spam.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar enlace" })).not.toBeInTheDocument();
  });

  it("rejects a mismatched new password from the email link", async () => {
    window.history.replaceState(null, "", "/escalada/reset/nueva");
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Nueva contraseña"), "password1");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "password2");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
    expect(auth.client.updatePassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nueva contraseña")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("Confirmar contraseña")).toHaveAttribute("autocomplete", "new-password");
  });

  it("updates the password from a recovery session", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    await screen.findByRole("button", { name: "Iniciar sesión" });

    act(() => auth.emit("PASSWORD_RECOVERY", { user: { id: "user-1", email: "mateo@example.com" } }));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Nueva contraseña"), "new-password1");
    expect(window.location.pathname).toBe("/escalada/reset/nueva");
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
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("invalid_credentials");
  });

  it("offers to resend when the email is unconfirmed", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockResolvedValue({ session: null, error: "email_not_confirmed" });
    renderGate(auth.client);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Confirma tu correo para continuar. Reenviar enlace");
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));
    expect(auth.client.resendConfirmation).toHaveBeenCalledWith("mateo@example.com", "https://example.com/escalada/");
  });

  it("reports a lost connection without a provider message", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockRejectedValue(new TypeError("Failed to fetch"));
    renderGate(auth.client);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión. Intenta de nuevo.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Failed to fetch");
  });

  it("sends a protected route through login and back to that path", async () => {
    window.history.replaceState(null, "", "/escalada/plan");
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockResolvedValue({
      session: { user: { id: "user-1", email: "mateo@example.com" } },
      error: null
    });
    renderGate(auth.client);
    const user = userEvent.setup();

    expect(await screen.findByText("Inicia sesión para ver tu plan.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/escalada/login");
    expect(new URLSearchParams(window.location.search).get("next")).toBe("/escalada/plan");

    await user.click(screen.getByRole("link", { name: "Crear cuenta" }));
    expect(window.location.pathname).toBe("/escalada/signup");
    expect(new URLSearchParams(window.location.search).get("next")).toBe("/escalada/plan");

    await user.click(screen.getByRole("link", { name: "Inicia sesión" }));
    await user.type(screen.getByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => expect(window.location.pathname).toBe("/escalada/plan"));
    expect(await screen.findByText("tracker for user-1")).toBeInTheDocument();
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com"])("ignores an open redirect in next (%s)", async (next) => {
    window.history.replaceState(null, "", `/escalada/login?next=${encodeURIComponent(next)}`);
    const auth = fakeClient();
    vi.mocked(auth.client.signIn).mockResolvedValue({
      session: { user: { id: "user-1", email: "mateo@example.com" } },
      error: null
    });
    renderGate(auth.client);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.type(screen.getByLabelText("Contraseña"), "password1");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => expect(window.location.pathname).toBe("/escalada/plan"));
    expect(window.location.href).not.toContain("evil.com");
  });

  it("sends an authenticated visit to login onward to the plan", async () => {
    renderGate(fakeClient({ user: { id: "user-1", email: "mateo@example.com" } }).client);
    await waitFor(() => expect(window.location.pathname).toBe("/escalada/plan"));
    expect(await screen.findByText("tracker for user-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar sesión" })).not.toBeInTheDocument();
  });

  it("renders the legal stubs instead of a login redirect", async () => {
    window.history.replaceState(null, "", "/escalada/terminos");
    renderGate(fakeClient().client);
    expect(await screen.findByRole("heading", { name: "Términos" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/escalada/terminos");

    window.history.replaceState(null, "", "/escalada/privacidad");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(await screen.findByRole("heading", { name: "Política de privacidad" })).toBeInTheDocument();
  });

  it("renders authenticated children", async () => {
    window.history.replaceState(null, "", "/escalada/");
    renderGate(fakeClient({ user: { id: "user-1", email: "mateo@example.com" } }).client);
    await waitFor(() => expect(screen.getByText("tracker for user-1")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Iniciar sesión" })).not.toBeInTheDocument();
  });
});
