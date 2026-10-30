import { describe, expect, it } from "vitest";

import { authRedirectUrl, passwordResetRedirectUrl, readAuthConfig } from "./auth-config";

describe("auth configuration", () => {
  it("accepts complete public configuration", () => {
    expect(readAuthConfig({
      VITE_SUPABASE_URL: "https://demo.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo"
    })).toEqual({
      url: "https://demo.supabase.co",
      publishableKey: "sb_publishable_demo"
    });
  });

  it("rejects missing public configuration", () => {
    expect(readAuthConfig({})).toBeNull();
  });

  it("returns the Vite base path for auth emails", () => {
    expect(authRedirectUrl("https://climb.example", "/escalada/")).toBe("https://climb.example/escalada/");
  });

  it("sends password reset emails to the new-password route", () => {
    expect(passwordResetRedirectUrl("https://climb.example/escalada/")).toBe("https://climb.example/escalada/reset/nueva");
  });
});
