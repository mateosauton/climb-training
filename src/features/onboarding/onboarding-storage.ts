import { LINK_EXPIRY_MINUTES } from "./onboarding-copy";

const PENDING_KEY = "maillon.magic-link.pending.v1";
const DECISION_KEY = "maillon.health-onboarding.v1";

export interface MagicLinkPending {
  email: string;
  sentAt: number;
}

export interface HealthDecision {
  choice: "skip" | "connected";
  connected: boolean;
  at: string;
}

type DecisionMap = Record<string, HealthDecision>;

function readJson<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function markMagicLinkSent(email: string, now = Date.now()) {
  const pending: MagicLinkPending = { email: email.trim(), sentAt: now };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function readMagicLinkPending(now = Date.now()): MagicLinkPending | null {
  const pending = readJson<MagicLinkPending>(PENDING_KEY);
  if (!pending?.email || typeof pending.sentAt !== "number") return null;
  if (now - pending.sentAt > LINK_EXPIRY_MINUTES * 60 * 1000) return null;
  return pending;
}

export function clearMagicLinkPending() {
  localStorage.removeItem(PENDING_KEY);
}

function readDecisions(): DecisionMap {
  return readJson<DecisionMap>(DECISION_KEY) ?? {};
}

export function readHealthDecision(userId: string): HealthDecision | null {
  return readDecisions()[userId] ?? null;
}

export function writeHealthDecision(userId: string, decision: HealthDecision) {
  const next = { ...readDecisions(), [userId]: decision };
  localStorage.setItem(DECISION_KEY, JSON.stringify(next));
}

export function isHealthConnected(userId: string): boolean {
  return readHealthDecision(userId)?.connected === true;
}

export function shouldOfferHealthOnboarding(userId: string, email: string | null, now = Date.now()): boolean {
  if (!email || readHealthDecision(userId)) return false;
  const pending = readMagicLinkPending(now);
  if (!pending) return false;
  return pending.email.toLowerCase() === email.toLowerCase();
}

export function finishHealthOnboarding(userId: string, choice: "skip" | "connected", now = new Date().toISOString()) {
  writeHealthDecision(userId, { choice, connected: choice === "connected", at: now });
  clearMagicLinkPending();
}

export function disconnectHealth(userId: string, now = new Date().toISOString()) {
  const current = readHealthDecision(userId);
  writeHealthDecision(userId, {
    choice: current?.choice ?? "skip",
    connected: false,
    at: now
  });
}
