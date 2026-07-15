import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AuthClient, AuthSession } from "./auth-client";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthProvider";

function client(session: AuthSession = null): AuthClient {
  return {
    getSession: vi.fn(async () => ({ session, error: null })),
    onAuthStateChange: vi.fn(() => () => undefined),
    signInWithApple: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null }))
  };
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
    const authClient = client();
    vi.mocked(authClient.getSession).mockReturnValue(new Promise(() => undefined));
    renderGate(authClient);
    expect(screen.getByText("Verificando tu sesión…")).toBeInTheDocument();
    expect(screen.queryByText(/tracker for/)).not.toBeInTheDocument();
  });

  it("shows setup guidance when public configuration is missing", async () => {
    renderGate(null);
    expect(await screen.findByRole("heading", { name: "Configura el acceso con Apple" })).toBeInTheDocument();
    expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument();
    expect(screen.queryByText(/tracker for/)).not.toBeInTheDocument();
  });

  it("starts Apple OAuth once", async () => {
    const authClient = client();
    renderGate(authClient);
    const button = await screen.findByRole("button", { name: "Continuar con Apple" });
    await userEvent.dblClick(button);
    expect(authClient.signInWithApple).toHaveBeenCalledOnce();
  });

  it("shows a recoverable OAuth error", async () => {
    const authClient = client();
    vi.mocked(authClient.signInWithApple).mockResolvedValue({ error: "private provider payload" });
    renderGate(authClient);
    await userEvent.click(await screen.findByRole("button", { name: "Continuar con Apple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión con Apple");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private provider payload");
  });

  it("renders authenticated children", async () => {
    renderGate(client({ user: { id: "apple-1", email: "mateo@example.com" } }));
    await waitFor(() => expect(screen.getByText("tracker for apple-1")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Continuar con Apple" })).not.toBeInTheDocument();
  });
});
