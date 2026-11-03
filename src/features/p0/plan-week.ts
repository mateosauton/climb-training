import { addUtcDays, type ScheduledPlanSession } from "../plan/active-plan";
import type { SessionLog } from "../../lib/training";

export interface PlanWeekEdits {
  skippedIds: string[];
  mobilitySwapIds: string[];
  movedDates: Record<string, string>;
}

export interface WeekPlanCard {
  sessionId: string;
  planSessionId: string;
  date: string;
  dateLabel: string;
  title: string;
  detail: string;
  mobility: boolean;
  skipped: boolean;
  completed: boolean;
  canStart: boolean;
  canSkip: boolean;
  canSwap: boolean;
  targetRpe: number;
  plannedAttempts: number;
  doseLabel: string;
}

export interface WeekPlanRow {
  sessionId: string;
  planSessionId: string;
  date: string;
  weekday: string;
  dayNumber: number;
  title: string;
  detail: string;
  badge: "Siguiente" | null;
  movable: boolean;
  mobility: boolean;
}

export interface WeekPlanView {
  overline: string;
  featured: WeekPlanCard | null;
  rows: WeekPlanRow[];
  earlierNote: string | null;
  showPainGuard: boolean;
  painHigh: boolean;
  weekDates: string[];
}

export interface LoggerDraft {
  sessionId: string;
  planSessionId: string;
  mobility: boolean;
  label: string;
  dateLabel: string;
  prefillNote: string;
  rpe: number;
  rpeHint: string;
  pain: number;
  painHint: string;
  attempts: number;
  doseLabel: string;
  bestLink: number | null;
  footCuts: number | null;
  notes: string;
}

const STORAGE_PREFIX = "maillon.plan-week.v1:";
const SHORT_WEEKDAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"] as const;

export function emptyPlanWeekEdits(): PlanWeekEdits {
  return { skippedIds: [], mobilitySwapIds: [], movedDates: {} };
}

export function loadPlanWeekEdits(storage: Storage, planId: string): PlanWeekEdits {
  try {
    const raw = storage.getItem(STORAGE_PREFIX + planId);
    if (!raw) return emptyPlanWeekEdits();
    const parsed = JSON.parse(raw) as Partial<PlanWeekEdits>;
    const movedDates = parsed.movedDates && typeof parsed.movedDates === "object"
      ? Object.fromEntries(Object.entries(parsed.movedDates).filter((entry): entry is [string, string] => typeof entry[1] === "string" && isIsoDate(entry[1])))
      : {};
    return {
      skippedIds: stringList(parsed.skippedIds),
      mobilitySwapIds: stringList(parsed.mobilitySwapIds),
      movedDates
    };
  } catch {
    return emptyPlanWeekEdits();
  }
}

export function savePlanWeekEdits(storage: Storage, planId: string, edits: PlanWeekEdits): void {
  storage.setItem(STORAGE_PREFIX + planId, JSON.stringify(edits));
}

export function skipSession(edits: PlanWeekEdits, sessionId: string): PlanWeekEdits {
  if (edits.skippedIds.includes(sessionId)) return edits;
  return { ...edits, skippedIds: [...edits.skippedIds, sessionId] };
}

export function undoSkip(edits: PlanWeekEdits, sessionId: string): PlanWeekEdits {
  return { ...edits, skippedIds: edits.skippedIds.filter((id) => id !== sessionId) };
}

export function swapToMobility(edits: PlanWeekEdits, sessionId: string, fromDate: string): PlanWeekEdits {
  return {
    skippedIds: edits.skippedIds.filter((id) => id !== sessionId),
    mobilitySwapIds: edits.mobilitySwapIds.includes(sessionId) ? edits.mobilitySwapIds : [...edits.mobilitySwapIds, sessionId],
    movedDates: { ...edits.movedDates, [sessionId]: nextThursday(fromDate) }
  };
}

export function undoSwap(edits: PlanWeekEdits, sessionId: string): PlanWeekEdits {
  const movedDates = { ...edits.movedDates };
  delete movedDates[sessionId];
  return {
    ...edits,
    mobilitySwapIds: edits.mobilitySwapIds.filter((id) => id !== sessionId),
    movedDates
  };
}

export function moveSession(edits: PlanWeekEdits, sessionId: string, date: string): PlanWeekEdits {
  if (!isIsoDate(date)) return edits;
  return { ...edits, movedDates: { ...edits.movedDates, [sessionId]: date } };
}

export function targetRpe(session: Pick<ScheduledPlanSession, "intensity" | "summary" | "subtitle" | "drills">): number {
  const blob = `${session.summary} ${session.subtitle} ${session.drills.join(" ")}`;
  const match = blob.match(/RPE\s*(\d{1,2})/i);
  if (match) {
    const value = Number(match[1]);
    if (value >= 1 && value <= 10) return value;
  }
  if (session.intensity === "alta") return 8;
  if (session.intensity === "baja") return 4;
  return 7;
}

export function plannedAttempts(session: Pick<ScheduledPlanSession, "subtitle" | "drills" | "summary">): number {
  const blob = `${session.subtitle} ${session.summary} ${session.drills.join(" ")}`;
  const match = blob.match(/(\d{1,3})\s*(?:x|×|series)/i);
  if (!match) return 1;
  const value = Number(match[1]);
  return value >= 0 && value <= 200 ? value : 1;
}

export function doseLabel(session: Pick<ScheduledPlanSession, "subtitle" | "summary">): string {
  const dose = session.subtitle.trim();
  if (dose && dose !== session.summary.trim()) return dose;
  return "Según el plan de hoy";
}

export function nextThursday(isoDate: string): string {
  const weekday = utcWeekday(isoDate);
  const delta = (4 - weekday + 7) % 7;
  return addUtcDays(isoDate, delta === 0 ? 7 : delta);
}

export function buildWeekPlan(input: {
  sessions: ScheduledPlanSession[];
  edits: PlanWeekEdits;
  today: string;
  completedSessionIds: ReadonlySet<string>;
  recentPain?: number;
}): WeekPlanView {
  const placed = placeSessions(input.sessions, input.edits, input.completedSessionIds);
  const featuredSource = pickFeatured(placed, input.today);
  const featured = featuredSource ? toCard(featuredSource, input.today) : null;
  const anchor = featured?.date ?? placed.find((item) => item.date >= input.today)?.date ?? placed[0]?.date ?? input.today;
  const weekDates = weekOf(anchor);
  const weekEnd = weekDates[6] ?? anchor;
  const rows = placed
    .filter((item) => item.key !== featuredSource?.key)
    .filter((item) => (item.date >= weekDates[0] && item.date <= weekEnd) || input.edits.movedDates[item.session.id] === item.date)
    .sort((left, right) => left.date.localeCompare(right.date) || left.session.position - right.session.position)
    .map((item) => toRow(item));
  const following = rows.find((row) => !row.mobility && row.date >= input.today);
  if (following && !featured?.canStart) following.badge = "Siguiente";
  if (featured?.canStart) {
    const next = rows.find((row) => row.date > featured.date);
    if (next) next.badge = "Siguiente";
  }
  const earlier = placed
    .filter((item) => item.completed && item.date < (featured?.date ?? input.today) && item.date >= weekDates[0] && item.kind === "session")
    .sort((left, right) => left.date.localeCompare(right.date))[0];
  const totalWeeks = Math.max(1, ...input.sessions.map((session) => session.week));
  const focus = featuredSource?.session ?? input.sessions[0];
  return {
    overline: focus ? `Semana ${focus.week} de ${totalWeeks} · ${focus.phase}` : "Plan",
    featured,
    rows,
    earlierNote: earlier ? `${shortDate(earlier.date)} · ${earlier.session.title} · hecha` : null,
    showPainGuard: Boolean(featured && featured.canSwap),
    painHigh: (input.recentPain ?? 0) > 2,
    weekDates
  };
}

export function buildLoggerDraft(input: {
  sessions: ScheduledPlanSession[];
  edits: PlanWeekEdits;
  today: string;
  logs: ReadonlyArray<Pick<SessionLog, "createdAt" | "pain">>;
  sessionId?: string | null;
}): LoggerDraft | null {
  if (!input.sessions.length) return null;
  const placed = placeSessions(input.sessions, input.edits, new Set());
  const requested = input.sessionId ? placed.find((item) => item.session.id === input.sessionId && item.kind === "session") ?? placed.find((item) => item.key === input.sessionId) : null;
  const featured = requested ?? pickFeatured(placed, input.today);
  if (!featured) return null;
  const mobility = featured.kind === "mobility";
  const session = featured.session;
  const rpe = mobility ? 3 : targetRpe(session);
  const attempts = mobility ? 1 : plannedAttempts(session);
  const painLog = latestPain(input.logs, input.today);
  const pain = painLog?.pain ?? 0;
  const onPlanDay = featured.date === input.today;
  return {
    sessionId: featured.key,
    planSessionId: session.id,
    mobility,
    label: mobility ? "Movilidad" : session.title,
    dateLabel: onPlanDay ? `hoy, ${longDate(featured.date)}` : longDate(featured.date),
    prefillNote: mobility
      ? "Cambio por dolor: movilidad de 20 min. La fuerza pasó al jueves. Tocá solo lo que cambió."
      : onPlanDay
        ? "Prellenado con lo planificado para hoy. Tocá solo lo que cambió."
        : "No hay sesión hoy. Prellenamos la próxima del plan. Tocá solo lo que cambió.",
    rpe,
    rpeHint: mobility ? "movilidad" : "plan",
    pain,
    painHint: painLog ? (painLog.yesterday ? "como ayer" : "última sesión") : "sin molestia",
    attempts,
    doseLabel: mobility ? "20 min · cadera, hombros y dedos" : doseLabel(session),
    bestLink: null,
    footCuts: null,
    notes: ""
  };
}

interface Placed {
  key: string;
  kind: "session" | "mobility";
  session: ScheduledPlanSession;
  date: string;
  skipped: boolean;
  completed: boolean;
}

function placeSessions(sessions: ScheduledPlanSession[], edits: PlanWeekEdits, completedSessionIds: ReadonlySet<string>): Placed[] {
  return sessions.flatMap((session) => {
    const swapped = edits.mobilitySwapIds.includes(session.id);
    const date = edits.movedDates[session.id] ?? session.date;
    const skipped = edits.skippedIds.includes(session.id);
    const completed = completedSessionIds.has(session.id);
    const strength: Placed = { key: session.id, kind: "session", session, date, skipped, completed };
    if (!swapped) return [strength];
    const mobility: Placed = {
      key: `${session.id}::mobility`,
      kind: "mobility",
      session,
      date: session.date,
      skipped: false,
      completed: completedSessionIds.has(`${session.id}::mobility`)
    };
    return [mobility, strength];
  });
}

function pickFeatured(placed: Placed[], today: string): Placed | null {
  const open = (item: Placed) => !item.skipped && !item.completed;
  return placed.find((item) => item.date === today && open(item) && item.kind === "mobility")
    ?? placed.find((item) => item.date === today && open(item))
    ?? placed.find((item) => item.date === today)
    ?? placed.filter((item) => item.date >= today && open(item)).sort(byDate)[0]
    ?? placed.filter((item) => item.date >= today).sort(byDate)[0]
    ?? sortedLast(placed);
}

function toCard(item: Placed, today: string): WeekPlanCard {
  const mobility = item.kind === "mobility";
  const title = mobility ? "Movilidad" : item.session.title;
  const open = !item.skipped && !item.completed;
  return {
    sessionId: item.key,
    planSessionId: item.session.id,
    date: item.date,
    dateLabel: item.date === today ? `HOY · ${shortDate(item.date)}` : shortDate(item.date),
    title,
    detail: mobility ? "20 min · RPE objetivo 3" : sessionDetail(item.session),
    mobility,
    skipped: item.skipped,
    completed: item.completed,
    canStart: open,
    canSkip: open && !mobility,
    canSwap: open && !mobility,
    targetRpe: mobility ? 3 : targetRpe(item.session),
    plannedAttempts: mobility ? 1 : plannedAttempts(item.session),
    doseLabel: mobility ? "20 min · cadera, hombros y dedos" : doseLabel(item.session)
  };
}

function toRow(item: Placed): WeekPlanRow {
  const mobility = item.kind === "mobility";
  return {
    sessionId: item.key,
    planSessionId: item.session.id,
    date: item.date,
    weekday: SHORT_WEEKDAYS[utcWeekday(item.date)],
    dayNumber: utcDay(item.date),
    title: mobility ? "Movilidad" : item.session.title,
    detail: mobility ? "20 min · RPE 3" : `${item.session.durationMinutes} min · RPE ${targetRpe(item.session)}`,
    badge: null,
    movable: item.kind === "session" && !item.completed,
    mobility
  };
}

function sessionDetail(session: ScheduledPlanSession): string {
  const dose = doseLabel(session);
  const head = dose === "Según el plan de hoy" ? session.phase : dose;
  return `${head} · ${session.durationMinutes} min · RPE objetivo ${targetRpe(session)}`;
}

function latestPain(logs: ReadonlyArray<Pick<SessionLog, "createdAt" | "pain">>, today: string): { pain: number; yesterday: boolean } | null {
  const sorted = [...logs].filter((log) => Number.isFinite(log.pain)).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const latest = sorted.length ? sorted[sorted.length - 1] : undefined;
  if (!latest) return null;
  const loggedDay = latest.createdAt.slice(0, 10);
  return { pain: clamp(Math.round(latest.pain), 0, 10), yesterday: loggedDay === addUtcDays(today, -1) };
}

function sortedLast(placed: Placed[]): Placed | null {
  if (!placed.length) return null;
  return [...placed].sort(byDate)[placed.length - 1] ?? null;
}

function byDate(left: Placed, right: Placed): number {
  return left.date.localeCompare(right.date) || left.session.position - right.session.position;
}

function weekOf(isoDate: string): string[] {
  const weekday = utcWeekday(isoDate);
  const monday = addUtcDays(isoDate, weekday === 0 ? -6 : 1 - weekday);
  return Array.from({ length: 7 }, (_, index) => addUtcDays(monday, index));
}

function shortDate(isoDate: string): string {
  return `${SHORT_WEEKDAYS[utcWeekday(isoDate)]} ${utcDay(isoDate)}`;
}

function longDate(isoDate: string): string {
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${SHORT_WEEKDAYS[utcWeekday(isoDate)].toLowerCase()} ${day} ${months[month - 1]}${year ? "" : ""}`;
}

function utcWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function utcDay(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
