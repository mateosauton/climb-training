import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return {
    unsubscribe,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    verifyOtp: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    createClient: vi.fn()
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient
}));

import { createSupabaseAuthClient } from "./auth-client";

function session(id = "user-1", email: string | null | undefined = "mateo@example.com") {
  return { user: { id, email, privateMetadata: "not exposed" }, access_token: "not exposed" };
}

describe("createSupabaseAuthClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue({ auth: mocks });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("maps email auth operations to Supabase", async () => {
    const client = createSupabaseAuthClient({ url: "https://project.supabase.co", publishableKey: "public-key" });

    await client.signUp("user@example.com", "password1", "https://app.test/escalada/");
    await client.verifyEmailCode("user@example.com", "123456");
    await client.signIn("user@example.com", "password1");
    await client.requestPasswordReset("user@example.com", "https://app.test/escalada/");
    await client.updatePassword("new-password1");

    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password1",
      options: { emailRedirectTo: "https://app.test/escalada/" }
    });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "user@example.com", token: "123456", type: "email" });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "password1" });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", { redirectTo: "https://app.test/escalada/" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password1" });
  });

  it("returns the verified session from an email code", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: session("verified-user") }, error: null });
    const client = createSupabaseAuthClient({ url: "https://project.supabase.co", publishableKey: "public-key" });

    await expect(client.verifyEmailCode("mateo@example.com", "123456")).resolves.toEqual({
      session: { user: { id: "verified-user", email: "mateo@example.com" } },
      error: null
    });
  });

  it("returns only the mapped user from a session", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: session() }, error: null });
    const client = createSupabaseAuthClient({ url: "https://project.supabase.co", publishableKey: "public-key" });

    await expect(client.signIn("mateo@example.com", "password1")).resolves.toEqual({
      session: { user: { id: "user-1", email: "mateo@example.com" } },
      error: null
    });
  });

  it("forwards auth events and unsubscribes", () => {
    let callback: ((event: string, value: unknown) => void) | undefined;
    mocks.onAuthStateChange.mockImplementation((next) => {
      callback = next;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    const client = createSupabaseAuthClient({ url: "https://project.supabase.co", publishableKey: "public-key" });
    const listener = vi.fn();

    const unsubscribe = client.onAuthStateChange(listener);
    callback?.("PASSWORD_RECOVERY", session("recovery-user", null));
    unsubscribe();

    expect(listener).toHaveBeenCalledWith("PASSWORD_RECOVERY", {
      user: { id: "recovery-user", email: null }
    });
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it.each([
    ["invalid_credentials", 400, "invalid_credentials"],
    ["weak_password", 422, "weak_password"],
    ["over_email_send_rate_limit", 429, "email_rate_limit"],
    ["over_request_rate_limit", 429, "rate_limit"],
    ["otp_expired", 403, "expired_link"],
    ["unexpected", 500, "unknown"]
  ])("sanitizes %s failures", async (code, status, expected) => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code, status, message: "private provider details" }
    });
    const client = createSupabaseAuthClient({ url: "https://project.supabase.co", publishableKey: "public-key" });

    await expect(client.signIn("mateo@example.com", "wrong-password")).resolves.toEqual({
      session: null,
      error: expected
    });
  });
});
