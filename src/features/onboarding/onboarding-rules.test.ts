import { describe, expect, it } from "vitest";

import { isValidEmail, mailAppHref, resendCooldownLabel, resendCooldownMs } from "./email";
import { LINK_EXPIRY_MINUTES, RESEND_COOLDOWN_SECONDS } from "./onboarding-copy";
import { screensBeforeHoy } from "./onboarding-path";
import { nativeHealthPlatform } from "./health-platform";
import { finishHealthOnboarding, isHealthConnected, markMagicLinkSent, readMagicLinkPending, shouldOfferHealthOnboarding, disconnectHealth } from "./onboarding-storage";

describe("onboarding rules", () => {
  it("reaches Hoy in 3 screens when Salud is skipped and 4 when connected", () => {
    expect(screensBeforeHoy("skip")).toBeLessThanOrEqual(3);
    expect(screensBeforeHoy("connect")).toBeLessThanOrEqual(4);
    expect(screensBeforeHoy("skip")).toBe(3);
    expect(screensBeforeHoy("connect")).toBe(4);
  });

  it("rejects a mailbox without a domain and accepts a normal address", () => {
    expect(isValidEmail("mateo@correo")).toBe(false);
    expect(isValidEmail("mateo@correo.com")).toBe(true);
    expect(isValidEmail("  mateo@correo.com  ")).toBe(true);
  });

  it("formats a 60 second resend cooldown and a 15 minute link window", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(LINK_EXPIRY_MINUTES).toBe(15);
    expect(resendCooldownMs()).toBe(60_000);
    expect(resendCooldownLabel(58_000)).toBe("Reenviar en 0:58");
  });

  it("picks a single native health provider", () => {
    expect(nativeHealthPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(nativeHealthPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(nativeHealthPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("ios");
    expect(mailAppHref("Mozilla/5.0 (iPhone)")).toBe("message://");
  });

  it("offers Salud only after a fresh magic link for that account", () => {
    localStorage.clear();
    expect(shouldOfferHealthOnboarding("user-1", "mateo@correo.com")).toBe(false);
    markMagicLinkSent("mateo@correo.com", 1_000);
    expect(shouldOfferHealthOnboarding("user-1", "mateo@correo.com", 1_000 + 60_000)).toBe(true);
    expect(shouldOfferHealthOnboarding("user-1", "otra@correo.com", 1_000 + 60_000)).toBe(false);
    expect(shouldOfferHealthOnboarding("user-1", null, 1_000 + 60_000)).toBe(false);
    expect(readMagicLinkPending(1_000 + 16 * 60 * 1000)).toBeNull();
    finishHealthOnboarding("user-1", "connected", "2026-11-04T00:00:00.000Z");
    expect(isHealthConnected("user-1")).toBe(true);
    expect(shouldOfferHealthOnboarding("user-1", "mateo@correo.com", 2_000)).toBe(false);
    disconnectHealth("user-1");
    expect(isHealthConnected("user-1")).toBe(false);
    expect(shouldOfferHealthOnboarding("user-1", "mateo@correo.com", 2_000)).toBe(false);
  });
});
