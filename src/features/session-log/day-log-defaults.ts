import { logNumberFields, logNumberLimits, type LogNumberKey, type SessionLog, type TrainingSession } from "../../lib/training";

export const quickLogFields = ["rpe", "pain", "attempts"] as const satisfies readonly LogNumberKey[];

export const advancedLogFields = ["pump", "moves", "bestLink", "footCuts", "pullWeight", "sleep", "energy"] as const satisfies readonly LogNumberKey[];

const blankOptionalDefaults: Record<(typeof advancedLogFields)[number], number> = {
  pump: 0,
  moves: 0,
  bestLink: 0,
  footCuts: 0,
  pullWeight: 0,
  sleep: 7,
  energy: 7
};

export type DayLogDefaultSource = "same-session" | "day-type" | "plan-day";

export interface DayLogNumbers {
  rpe: number;
  pain: number;
  attempts: number;
  pump: number;
  moves: number;
  bestLink: number;
  footCuts: number;
  pullWeight: number;
  sleep: number;
  energy: number;
}

export interface ResolvedDayLog {
  values: DayLogNumbers;
  notes: string;
  source: DayLogDefaultSource;
  sourceLabel: string;
}

export interface DayLogFormValues extends Record<LogNumberKey, string> {
  notes: string;
}

export type LogMetricsResult =
  | { ok: true; metrics: DayLogNumbers }
  | { ok: false; field: LogNumberKey; message: string };

type DaySession = Pick<TrainingSession, "id" | "type" | "intensity" | "drills">;

interface ResolveDayLogInput {
  session: DaySession;
  sessions: Array<Pick<TrainingSession, "id" | "type">>;
  logs: SessionLog[];
}

function isRecoveryDay(session: Pick<TrainingSession, "type">): boolean {
  return /descanso|recuperaci[oó]n|movilidad|revisi[oó]n/i.test(session.type);
}

function plannedHardAttempts(drills: string[]): number | null {
  for (const line of drills) {
    if (/por\s+problema/i.test(line)) continue;
    const moveAttempts = line.match(/(\d+)\s*(?:[-–]|a)\s*(\d+)\s+movimientos\s+(?:duros|m[aá]ximos)/i);
    if (moveAttempts) return Number(moveAttempts[1]);
    const range = line.match(/(\d+)\s*(?:[-–]|a)\s*(\d+)\s+(?:intentos|pegues)\b/i);
    if (range) return Number(range[1]);
    const single = line.match(/(\d+)\s+(?:intentos|pegues)\b/i);
    if (single) return Number(single[1]);
  }
  return null;
}

function plannedMoves(drills: string[]): number | null {
  for (const line of drills) {
    if (/movimientos\s+(?:duros|m[aá]ximos)/i.test(line)) continue;
    const range = line.match(/(\d+)\s*(?:[-–]|a)\s*(\d+)\s+movimientos/i);
    if (range) return Number(range[1]);
  }
  return null;
}

function planDayBaseline(session: DaySession): DayLogNumbers {
  if (isRecoveryDay(session)) {
    return {
      rpe: 3,
      pain: 0,
      attempts: 0,
      pump: 0,
      moves: 0,
      bestLink: 0,
      footCuts: 0,
      pullWeight: 0,
      sleep: 7,
      energy: 7
    };
  }
  const attempts = plannedHardAttempts(session.drills)
    ?? (session.intensity === "alta" ? 12 : session.intensity === "media" ? 8 : 4);
  return {
    rpe: session.intensity === "alta" ? 8 : session.intensity === "media" ? 7 : 5,
    pain: 0,
    attempts,
    pump: session.intensity === "alta" ? 6 : session.intensity === "media" ? 4 : 2,
    moves: plannedMoves(session.drills) ?? 0,
    bestLink: 0,
    footCuts: 0,
    pullWeight: 0,
    sleep: 7,
    energy: 7
  };
}

function numbersFromLog(entry: SessionLog): DayLogNumbers {
  return {
    rpe: entry.rpe,
    pain: entry.pain,
    attempts: entry.attempts,
    pump: entry.pump,
    moves: entry.moves,
    bestLink: entry.bestLink,
    footCuts: entry.footCuts,
    pullWeight: entry.pullWeight,
    sleep: entry.sleep,
    energy: entry.energy
  };
}

function latestLog(logs: SessionLog[], predicate: (entry: SessionLog) => boolean): SessionLog | undefined {
  const matches = logs.filter(predicate).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return matches[matches.length - 1];
}

export function resolveDayLogDefaults({ session, sessions, logs }: ResolveDayLogInput): ResolvedDayLog {
  const sameSession = latestLog(logs, (entry) => entry.sessionId === session.id);
  if (sameSession) {
    return {
      values: numbersFromLog(sameSession),
      notes: "",
      source: "same-session",
      sourceLabel: "Retomado de tu registro de este día. Revisá y guardá."
    };
  }

  const typeById = new Map(sessions.map((item) => [item.id, item.type.trim().toLocaleLowerCase("es")]));
  const dayType = session.type.trim().toLocaleLowerCase("es");
  const sameType = dayType
    ? latestLog(logs, (entry) => entry.sessionId !== session.id && typeById.get(entry.sessionId) === dayType)
    : undefined;
  if (sameType) {
    return {
      values: numbersFromLog(sameType),
      notes: "",
      source: "day-type",
      sourceLabel: `Según tu última sesión de ${session.type}. Revisá y guardá.`
    };
  }

  return {
    values: planDayBaseline(session),
    notes: "",
    source: "plan-day",
    sourceLabel: "Sugerido para este día. Revisá y guardá."
  };
}

export function dayLogFormValues(resolved: ResolvedDayLog): DayLogFormValues {
  return {
    rpe: String(resolved.values.rpe),
    pump: String(resolved.values.pump),
    pain: String(resolved.values.pain),
    attempts: String(resolved.values.attempts),
    moves: String(resolved.values.moves),
    bestLink: String(resolved.values.bestLink),
    footCuts: String(resolved.values.footCuts),
    pullWeight: String(resolved.values.pullWeight),
    sleep: String(resolved.values.sleep),
    energy: String(resolved.values.energy),
    notes: resolved.notes
  };
}

function isBlank(value: string | undefined): boolean {
  return (value ?? "").trim() === "";
}

export function metricsFromLogForm(form: Partial<Record<LogNumberKey, string>> & { notes?: string }): LogMetricsResult {
  const metrics = {} as DayLogNumbers;
  for (const field of logNumberFields) {
    const optional = (advancedLogFields as readonly string[]).includes(field);
    if (optional && isBlank(form[field])) {
      metrics[field] = blankOptionalDefaults[field as (typeof advancedLogFields)[number]];
      continue;
    }
    const numeric = Number(form[field]);
    const limit = logNumberLimits[field];
    if (!Number.isFinite(numeric) || numeric < limit.min || numeric > limit.max) {
      return { ok: false, field, message: `${limit.label}: usa un valor entre ${limit.min} y ${limit.max}.` };
    }
    metrics[field] = numeric;
  }
  return { ok: true, metrics };
}

export function quickLogLabel(field: (typeof quickLogFields)[number]): string {
  if (field === "attempts") return "Intentos duros";
  return logNumberLimits[field].label;
}
