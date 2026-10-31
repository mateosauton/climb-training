import { describe, expect, it } from "vitest";

import {
  acceptNext,
  appTabForPath,
  authPath,
  authScreenFromPathname,
  destinationAfterLogin,
  loginRedirectFor
} from "./auth-routes";

describe("auth routes", () => {
  it("maps dedicated gate paths, including a trailing slash", () => {
    expect(authScreenFromPathname("/escalada/login")).toBe("login");
    expect(authScreenFromPathname("/escalada/signup/")).toBe("signup");
    expect(authScreenFromPathname("/escalada/reset")).toBe("reset");
    expect(authScreenFromPathname("/escalada/reset/nueva")).toBe("reset-new");
    expect(authScreenFromPathname("/escalada/terminos")).toBe("terms");
    expect(authScreenFromPathname("/escalada/privacidad")).toBe("privacy");
    expect(authScreenFromPathname("/escalada/plan")).toBeNull();
  });

  it("accepts only relative paths under /escalada/", () => {
    expect(acceptNext("/escalada/plan")).toBe("/escalada/plan");
    expect(acceptNext("/escalada/plan?week=2#hoy")).toBe("/escalada/plan?week=2#hoy");
    expect(acceptNext("/escalada/")).toBe("/escalada/");
    expect(acceptNext("/escalada/plan/")).toBe("/escalada/plan");
    expect(acceptNext(null)).toBeNull();
    expect(acceptNext("")).toBeNull();
    expect(acceptNext("/escalada")).toBeNull();
    expect(acceptNext("https://evil.com")).toBeNull();
    expect(acceptNext("//evil.com")).toBeNull();
    expect(acceptNext("/\\evil.com")).toBeNull();
    expect(acceptNext("/%2F%2Fevil.com")).toBeNull();
    expect(acceptNext("/escalada/%2e%2e/%2e%2e/evil.com")).toBeNull();
    expect(acceptNext("/escalada/plan\nhttps://evil.com")).toBeNull();
  });

  it("sends rejected next values to the plan and keeps safe ones", () => {
    expect(destinationAfterLogin(null)).toBe("/escalada/plan");
    expect(destinationAfterLogin("https://evil.com")).toBe("/escalada/plan");
    expect(destinationAfterLogin("//evil.com")).toBe("/escalada/plan");
    expect(destinationAfterLogin("/escalada/login")).toBe("/escalada/plan");
    expect(destinationAfterLogin("/escalada/reset/nueva")).toBe("/escalada/plan");
    expect(destinationAfterLogin("/escalada/sesion")).toBe("/escalada/sesion");
  });

  it("builds a login redirect that preserves a safe return path", () => {
    expect(loginRedirectFor("/escalada/plan", "")).toBe("/escalada/login?next=%2Fescalada%2Fplan");
    expect(loginRedirectFor("/escalada/plan", "?week=2")).toBe("/escalada/login?next=%2Fescalada%2Fplan%3Fweek%3D2");
    expect(loginRedirectFor("//evil.com", "")).toBe("/escalada/login");
  });

  it("keeps next on the other gate screens", () => {
    expect(authPath("signup", "/escalada/plan")).toBe("/escalada/signup?next=%2Fescalada%2Fplan");
    expect(authPath("reset", "https://evil.com")).toBe("/escalada/reset");
    expect(authPath("terms", null)).toBe("/escalada/terminos");
  });

  it("opens the plan tab only for the plan path", () => {
    expect(appTabForPath("/escalada/plan")).toBe("plan");
    expect(appTabForPath("/escalada/plan/")).toBe("plan");
    expect(appTabForPath("/escalada/")).toBe("dashboard");
  });
});
