import { RESEND_COOLDOWN_SECONDS } from "./onboarding-copy";

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function resendCooldownLabel(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `Reenviar en ${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function resendCooldownMs(seconds = RESEND_COOLDOWN_SECONDS): number {
  return seconds * 1000;
}

export function mailAppHref(userAgent: string): string {
  if (/android/i.test(userAgent)) {
    return "intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end";
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "message://";
  return "mailto:";
}
