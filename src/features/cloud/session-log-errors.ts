export type SessionLogFailureCode =
  | "validation"
  | "unauthenticated"
  | "schema"
  | "network"
  | "local_storage";

export interface SessionLogFailure {
  code: SessionLogFailureCode;
  cause: string;
}

export interface SessionLogObservation {
  name: "session_log_save_failed";
  code: SessionLogFailureCode;
  cause: string;
}

const APPLICATION_CODES = new Set<SessionLogFailureCode>([
  "validation",
  "unauthenticated",
  "schema",
  "network",
  "local_storage"
]);

const SAFE_CAUSE = /^[A-Za-z0-9_.:-]{1,64}$/;

let observer: (event: SessionLogObservation) => void = (event) => {
  console.info(JSON.stringify({ name: event.name, code: event.code, cause: event.cause }));
};

export function setSessionLogObserver(next: (event: SessionLogObservation) => void): void {
  observer = next;
}

export function resetSessionLogObserver(): void {
  observer = (event) => {
    console.info(JSON.stringify({ name: event.name, code: event.code, cause: event.cause }));
  };
}

export function recordSessionLogFailure(code: SessionLogFailureCode, cause: string): void {
  observer({
    name: "session_log_save_failed",
    code,
    cause: SAFE_CAUSE.test(cause) ? cause : "unknown"
  });
}

export function isSessionLogFailure(error: unknown): error is SessionLogFailure {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  return typeof candidate.cause === "string" && typeof candidate.code === "string" && APPLICATION_CODES.has(candidate.code as SessionLogFailureCode);
}

export function readSessionLogCause(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const candidate = error as { code?: unknown; status?: unknown; name?: unknown };
  if (candidate.code === "unauthenticated") return "unauthenticated";
  if (typeof candidate.code === "string" && SAFE_CAUSE.test(candidate.code)) return candidate.code;
  if (typeof candidate.status === "number" && candidate.status >= 100 && candidate.status <= 599) return `http_${candidate.status}`;
  if (candidate.name === "TypeError" || candidate.name === "NetworkError") return "network";
  return "unknown";
}

export function classifySessionLogError(error: unknown): SessionLogFailure {
  const cause = readSessionLogCause(error);
  if (["unauthenticated", "PGRST301", "28000", "http_401", "http_403", "42501"].includes(cause)) {
    return { code: "unauthenticated", cause };
  }
  if (["23514", "23502", "23503", "22023", "22P02"].includes(cause)) {
    return { code: "validation", cause };
  }
  if (["42703", "42P01", "42P10", "PGRST100", "PGRST202", "PGRST204", "PGRST205"].includes(cause)) {
    return { code: "schema", cause };
  }
  return { code: "network", cause };
}

export function sessionLogFailureMessage(code: SessionLogFailureCode): string {
  switch (code) {
    case "validation":
      return "Hay un dato del log que la nube no acepta. Revisá los valores y reintentá. El log queda pendiente.";
    case "unauthenticated":
      return "No pudimos confirmar tu sesión. Volvé a iniciar sesión y reintentá. El log queda pendiente.";
    case "schema":
      return "La nube todavía no tiene la estructura de este log. Reintentá cuando termine la actualización. El log queda pendiente.";
    case "network":
      return "No pudimos conectar con la nube. El log queda pendiente de sincronización.";
    case "local_storage":
      return "No pudimos guardar una copia local para reintentar, así que no enviamos el log.";
  }
}

export const sessionLogCloudWithoutLocalMessage =
  "El log se guardó en la nube, pero no pudimos verificar la copia en este dispositivo.";
