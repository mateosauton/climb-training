export const PLAN_PATH = "/escalada/plan";

const AUTH_PATHS = {
  login: "/escalada/login",
  signup: "/escalada/signup",
  reset: "/escalada/reset",
  "reset-new": "/escalada/reset/nueva",
  terms: "/escalada/terminos",
  privacy: "/escalada/privacidad"
} as const;

export type AuthScreen = keyof typeof AUTH_PATHS;

const CREDENTIAL_SCREENS = new Set<AuthScreen>(["login", "signup", "reset", "reset-new"]);
const APP_PREFIX = "/escalada/";

function canonicalPathname(pathname: string): string {
  if (pathname.length > APP_PREFIX.length && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function authScreenFromPathname(pathname: string): AuthScreen | null {
  const path = canonicalPathname(pathname);
  const match = (Object.entries(AUTH_PATHS) as [AuthScreen, string][]).find(([, href]) => href === path);
  return match?.[0] ?? null;
}

export function isCredentialScreen(screen: AuthScreen | null): boolean {
  return screen !== null && CREDENTIAL_SCREENS.has(screen);
}

export function appTabForPath(pathname: string): "plan" | "dashboard" {
  return canonicalPathname(pathname) === PLAN_PATH ? "plan" : "dashboard";
}

function hasBlockedCharacters(value: string): boolean {
  return /[\u0000-\u001F\\]/.test(value);
}

/** Relative in-app path, or null when the value could leave this origin. */
export function acceptNext(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || hasBlockedCharacters(trimmed)) return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  if (!decoded.startsWith(APP_PREFIX) || decoded.startsWith("//") || hasBlockedCharacters(decoded)) return null;
  if (decoded.includes("://")) return null;

  let url: URL;
  try {
    url = new URL(decoded, "https://maillon.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://maillon.invalid" || url.username || url.password) return null;
  const pathname = canonicalPathname(url.pathname);
  if (!pathname.startsWith(APP_PREFIX)) return null;
  return pathname + url.search + url.hash;
}

export function destinationAfterLogin(raw: string | null | undefined): string {
  const accepted = acceptNext(raw);
  if (!accepted) return PLAN_PATH;
  const pathname = new URL(accepted, "https://maillon.invalid").pathname;
  if (isCredentialScreen(authScreenFromPathname(pathname))) return PLAN_PATH;
  return accepted;
}

export function loginRedirectFor(pathname: string, search: string): string {
  const path = canonicalPathname(pathname);
  const suffix = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const next = acceptNext(`${path}${suffix}`);
  return next ? `${AUTH_PATHS.login}?next=${encodeURIComponent(next)}` : AUTH_PATHS.login;
}

export function authPath(screen: AuthScreen, next: string | null | undefined): string {
  const accepted = acceptNext(next);
  return accepted ? `${AUTH_PATHS[screen]}?next=${encodeURIComponent(accepted)}` : AUTH_PATHS[screen];
}

export function navigate(href: string, mode: "push" | "replace" = "push") {
  const current = window.location.pathname + window.location.search;
  if (current === href) return;
  const method = mode === "replace" ? "replaceState" : "pushState";
  window.history[method](null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
