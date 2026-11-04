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
    requestMagicLink: vi.fn(async () => ({ error: null })),
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
    localStorage.clear();
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

  it("shows the magic-link gate without a password or code field", async () => {
    renderGate(fakeClient().client);
    expect(await screen.findByRole("heading", { name: "Maillon" })).toBeInTheDocument();
    expect(screen.getByText("Entra o crea tu cuenta con tu correo. Sin contraseña.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeInTheDocument();
    expect(screen.getByText("Si es tu primera vez, el mismo link crea tu cuenta.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Crear cuenta" })).not.toBeInTheDocument();
    expect(document.querySelector(".auth-gate")).toHaveClass("auth-gate");
    expect(screen.getByRole("button", { name: "Enviar link" })).toHaveClass("auth-primary");

    const email = screen.getByLabelText("Correo");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveClass("auth-input");
  });

  it("sends a magic link and shows the 15 minute check-email screen", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(auth.client.requestMagicLink).toHaveBeenCalledWith("mateo@example.com", "https://example.com/escalada/");
    expect(auth.client.signIn).not.toHaveBeenCalled();
    expect(auth.client.signUp).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Revisa tu correo" })).toBeInTheDocument();
    expect(screen.getByText("Ábrelo desde este teléfono y entras directo. El link vence en 15 minutos.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
  });

  it("keeps password recovery reachable from the reset route", async () => {
    window.history.replaceState(null, "", "/escalada/reset/nueva");
    renderGate(fakeClient().client);
    const user = userEvent.setup();
    const password = await screen.findByLabelText("Nueva contraseña");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toBeInTheDocument();
  });

  it("enters the app when the magic link creates a session in this browser", async () => {
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(await screen.findByRole("heading", { name: "Revisa tu correo" })).toBeInTheDocument();

    vi.mocked(auth.client.getSession).mockResolvedValue({
      session: { user: { id: "verified-user", email: "mateo@example.com" } },
      error: null
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(auth.client.signIn).not.toHaveBeenCalled();
    expect(auth.client.verifyEmailCode).not.toHaveBeenCalled();
    expect(await screen.findByText("tracker for verified-user")).toBeInTheDocument();
  });

  it("uses the same magic-link gate for signup and rejects an invalid email locally", async () => {
    window.history.replaceState(null, "", "/escalada/signup?next=%2Fescalada%2Fplan");
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { name: "Maillon" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("next")).toBe("/escalada/plan");
    await user.type(screen.getByLabelText("Correo"), "mateo@correo");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese correo no parece válido. Revisa que tenga @ y dominio.");
    expect(auth.client.requestMagicLink).not.toHaveBeenCalled();
    expect(auth.client.signUp).not.toHaveBeenCalled();
  });

  it("requests a password reset without revealing account existence", async () => {
    window.history.replaceState(null, "", "/escalada/reset");
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();
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
    await screen.findByRole("button", { name: "Enviar link" });

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
    vi.mocked(auth.client.requestMagicLink).mockResolvedValue({ error: "unknown" });
    renderGate(auth.client);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos enviar el link. Intenta de nuevo.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("unknown");
    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
  });

  it("reports a lost connection without a provider message", async () => {
    const auth = fakeClient();
    vi.mocked(auth.client.requestMagicLink).mockRejectedValue(new TypeError("Failed to fetch"));
    renderGate(auth.client);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión. Intenta de nuevo.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Failed to fetch");
  });

  it("sends a protected route through the magic link and back to that path", async () => {
    window.history.replaceState(null, "", "/escalada/plan");
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();

    expect(await screen.findByText("Inicia sesión para ver tu plan.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/escalada/login");
    expect(new URLSearchParams(window.location.search).get("next")).toBe("/escalada/plan");

    await user.type(screen.getByLabelText("Correo"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
    vi.mocked(auth.client.getSession).mockResolvedValue({
      session: { user: { id: "user-1", email: "mateo@example.com" } },
      error: null
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(window.location.pathname).toBe("/escalada/plan"));
    expect(await screen.findByText("tracker for user-1")).toBeInTheDocument();
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com"])("ignores an open redirect in next (%s)", async (next) => {
    window.history.replaceState(null, "", `/escalada/login?next=${encodeURIComponent(next)}`);
    const auth = fakeClient();
    renderGate(auth.client);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Correo"), "mateo@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar link" }));
    vi.mocked(auth.client.getSession).mockResolvedValue({
      session: { user: { id: "user-1", email: "mateo@example.com" } },
      error: null
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(window.location.pathname).toBe("/escalada/plan"));
    expect(window.location.href).not.toContain("evil.com");
  });

  it("sends an authenticated visit to login onward to the plan", async () => {
    renderGate(fakeClient({ user: { id: "user-1", email: "mateo@example.com" } }).client);
    await waitFor(() => expect(window.location.pathname).toBe("/escalada/plan"));
    expect(await screen.findByText("tracker for user-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar link" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Enviar link" })).not.toBeInTheDocument();
  });
});
