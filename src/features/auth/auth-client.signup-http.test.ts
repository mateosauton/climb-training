import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createSupabaseAuthClient, type AuthClient } from "./auth-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("signup HTTP responses", () => {
  const respond = vi.fn<() => Response>();
  let client: AuthClient;

  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async () => respond()));
    client = createSupabaseAuthClient({ url: "https://project.supabase.co", publishableKey: "public-key" });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("maps a 200 body that still carries user_repeated_signup", async () => {
    respond.mockImplementation(() => jsonResponse({
      code: 200,
      error_code: "user_repeated_signup",
      msg: "User already registered"
    }));

    await expect(client.signUp("sautonmateo@gmail.com", "password1", "https://app.test/escalada/")).resolves.toEqual({
      session: null,
      error: "email_exists"
    });
  });

  it("maps a 200 obfuscated user with no identities", async () => {
    respond.mockImplementation(() => jsonResponse({
      id: "obfuscated-user",
      aud: "authenticated",
      email: "sautonmateo@gmail.com",
      identities: [],
      app_metadata: { provider: "email", providers: ["email"] }
    }));

    await expect(client.signUp("sautonmateo@gmail.com", "password1", "https://app.test/escalada/")).resolves.toEqual({
      session: null,
      error: "email_exists"
    });
  });

  it("maps a 422 email_exists error", async () => {
    respond.mockImplementation(() => jsonResponse({
      code: "email_exists",
      error_code: "email_exists",
      msg: "A user with this email address has already been registered"
    }, 422));

    await expect(client.signUp("sautonmateo@gmail.com", "password1", "https://app.test/escalada/")).resolves.toEqual({
      session: null,
      error: "email_exists"
    });
  });

  it("still treats a new unconfirmed signup as success without a session", async () => {
    respond.mockImplementation(() => jsonResponse({
      id: "new-user",
      aud: "authenticated",
      email: "new@example.com",
      identities: [{ identity_id: "identity-1", id: "new-user", provider: "email" }]
    }));

    await expect(client.signUp("new@example.com", "password1", "https://app.test/escalada/")).resolves.toEqual({
      session: null,
      error: null
    });
  });
});
