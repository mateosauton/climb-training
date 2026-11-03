import { describe, expect, it } from "vitest";

import { repeatedSignupFailure } from "./signup-errors";

const repeatedCodes = ["user_repeated_signup", "user_already_exists", "email_exists"] as const;

const repeatedMessages = [
  "User already registered",
  "A user with this email address has already been registered",
  "Email address already registered by another user"
] as const;

describe("repeatedSignupFailure", () => {
  it.each(repeatedCodes)("maps %s even when the HTTP status is 200", (code) => {
    expect(repeatedSignupFailure({
      error: { code, status: 200, message: "User already registered" },
      user: null,
      session: null
    })).toBe("email_exists");
  });

  it.each(repeatedMessages)("maps the known message %s without requiring a non-2xx status", (message) => {
    expect(repeatedSignupFailure({
      error: { code: null, status: 200, message },
      user: null,
      session: null
    })).toBe("email_exists");
  });

  it("reads a repeated-signup code from a successful HTTP body", () => {
    expect(repeatedSignupFailure({
      error: null,
      user: null,
      session: null,
      body: {
        code: 200,
        error_code: "user_repeated_signup",
        msg: "User already registered"
      }
    })).toBe("email_exists");
  });

  it("reads email_exists from a nested error object in the body", () => {
    expect(repeatedSignupFailure({
      error: null,
      user: null,
      session: null,
      body: {
        error: {
          code: "email_exists",
          message: "A user with this email address has already been registered"
        }
      }
    })).toBe("email_exists");
  });

  it("treats a confirmed-user obfuscated signup (empty identities, no session) as an existing account", () => {
    expect(repeatedSignupFailure({
      error: null,
      session: null,
      user: {
        id: "obfuscated-user",
        email: "sautonmateo@gmail.com",
        identities: []
      }
    })).toBe("email_exists");
  });

  it("does not treat a new unconfirmed signup as an existing account", () => {
    expect(repeatedSignupFailure({
      error: null,
      session: null,
      user: {
        id: "new-user",
        identities: [{ identity_id: "identity-1", provider: "email" }]
      }
    })).toBeNull();
  });

  it("keeps a real session even if identities are absent", () => {
    expect(repeatedSignupFailure({
      error: null,
      session: { access_token: "token" },
      user: { id: "user-1", identities: [] }
    })).toBeNull();
  });

  it("lets a different auth failure win over an empty identity list", () => {
    expect(repeatedSignupFailure({
      error: { code: "weak_password", status: 422, message: "Password should be at least 8 characters" },
      session: null,
      user: { id: "user-1", identities: [] }
    })).toBeNull();
  });

  it("ignores unrelated messages and numeric status codes", () => {
    expect(repeatedSignupFailure({
      error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" },
      user: null,
      session: null,
      body: { code: 200, msg: "ok" }
    })).toBeNull();
    expect(repeatedSignupFailure({
      error: null,
      user: null,
      session: null,
      body: { code: 200 }
    })).toBeNull();
  });
});
