import type { ActivePlan } from "../cloud/cloud-types";
import type { GuidedBlock, GuidedBlockPhase, GuidedExerciseSection, GuidedMedia, GuidedSessionDefinition } from "../guided-session/guided-session-types";
import type { Exercise, ExerciseReference, TrainingSession } from "../../lib/training";

export const DEMO_PLAN_LABEL = "Plan de demostración";

const SAFETY_NOTE = "Detené el trabajo ante dolor punzante o dolor mayor a 2/10.";

export interface PlanSchedule {
  startDate: string;
  weeklyAvailability: number;
  preferredWeekdays: number[] | null;
}

export interface ScheduledPlanSession extends TrainingSession {
  planId: string;
  position: number;
  durationMinutes: number;
  subtitle: string;
}

export interface ProjectedPlan {
  planId: string;
  sessions: ScheduledPlanSession[];
  exercisesBySessionId: Record<string, Array<Exercise & { id: string }>>;
  guidedDefinitions: Record<string, GuidedSessionDefinition>;
}

export type PlanProjection =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "ready"; plan: ProjectedPlan };

interface FactLike {
  fact_key?: unknown;
  key?: unknown;
  value?: unknown;
}

const WEEKDAY_NAMES: Record<string, number> = {
  domingo: 0,
  sunday: 0,
  lunes: 1,
  monday: 1,
  martes: 2,
  tuesday: 2,
  miercoles: 3,
  miércoles: 3,
  wednesday: 3,
  jueves: 4,
  thursday: 4,
  viernes: 5,
  friday: 5,
  sabado: 6,
  sábado: 6,
  saturday: 6
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function addUtcDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(earlier: string, later: string): number {
  const [startYear, startMonth, startDay] = earlier.split("-").map(Number);
  const [endYear, endMonth, endDay] = later.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((end - start) / 86_400_000);
}

function utcWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function factKey(fact: FactLike): string {
  if (typeof fact.fact_key === "string") return fact.fact_key;
  if (typeof fact.key === "string") return fact.key;
  return "";
}

function latestFact(records: FactLike[], key: string): unknown {
  const matches = records.filter((fact) => factKey(fact) === key);
  return matches.length ? matches[matches.length - 1]?.value : undefined;
}

function parseAvailability(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim().match(/^\d+/)?.[0]) : Number.NaN;
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 7) return null;
  return numeric;
}

function parseWeekdays(value: unknown): number[] | null {
  const tokens = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  if (!tokens.length) return null;
  const days = tokens.flatMap((token) => {
    if (typeof token === "number" && Number.isInteger(token) && token >= 0 && token <= 6) return [token];
    if (typeof token !== "string") return [];
    const trimmed = token.trim().toLowerCase();
    if (/^[0-6]$/.test(trimmed)) return [Number(trimmed)];
    const named = WEEKDAY_NAMES[trimmed];
    return named === undefined ? [] : [named];
  });
  return days.length ? [...new Set(days)] : null;
}

function publishedDate(publishedAt: string | null | undefined): string | null {
  if (typeof publishedAt !== "string" || publishedAt.length < 10) return null;
  const date = publishedAt.slice(0, 10);
  return isIsoDate(date) ? date : null;
}

export function readPlanSchedule(input: {
  facts?: FactLike[] | null;
  currentProfile?: FactLike[] | null;
  publishedAt?: string | null;
}): PlanSchedule | null {
  const records = [...(input.currentProfile ?? []), ...(input.facts ?? [])];
  const startDate = [latestFact(records, "planStartDate"), latestFact(records, "startDate"), publishedDate(input.publishedAt)].find(isIsoDate);
  if (!startDate) return null;
  return {
    startDate,
    weeklyAvailability: parseAvailability(latestFact(records, "weeklyAvailability")) ?? 7,
    preferredWeekdays: parseWeekdays(latestFact(records, "trainingWeekdays"))
  };
}

function alignWeekday(isoDate: string, weekdays: number[]): string {
  if (!weekdays.length) return isoDate;
  let cursor = isoDate;
  for (let step = 0; step < 14; step += 1) {
    if (weekdays.includes(utcWeekday(cursor))) return cursor;
    cursor = addUtcDays(cursor, 1);
  }
  return isoDate;
}

function sessionsInWindow(placed: string[], candidate: string): number {
  return placed.filter((date) => {
    const gap = daysBetween(date, candidate);
    return gap >= 0 && gap < 7;
  }).length;
}

export function scheduleOffsets(offsets: number[], schedule: PlanSchedule): string[] {
  const availability = Math.min(7, Math.max(1, Math.floor(schedule.weeklyAvailability) || 7));
  const preferred = schedule.preferredWeekdays ?? [];
  const placed: string[] = [];
  for (const offset of offsets) {
    let candidate = addUtcDays(schedule.startDate, Math.max(0, offset));
    if (placed.length && candidate <= placed[placed.length - 1]) candidate = addUtcDays(placed[placed.length - 1], 1);
    candidate = alignWeekday(candidate, preferred);
    let guard = 0;
    while (sessionsInWindow(placed, candidate) >= availability && guard < 366) {
      candidate = alignWeekday(addUtcDays(candidate, 1), preferred);
      if (placed.length && candidate <= placed[placed.length - 1]) {
        candidate = alignWeekday(addUtcDays(placed[placed.length - 1], 1), preferred);
      }
      guard += 1;
    }
    if (placed.length && candidate <= placed[placed.length - 1]) {
      candidate = alignWeekday(addUtcDays(placed[placed.length - 1], 1), preferred);
    }
    placed.push(candidate);
  }
  return placed;
}

function finiteInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function displayIntensity(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (["alta", "high", "hard", "maxima", "máxima"].includes(normalized)) return "alta";
  if (["media", "moderate", "medium"].includes(normalized)) return "media";
  if (["baja", "easy", "low", "recovery", "rest"].includes(normalized)) return "baja";
  return value || "media";
}

function clockRange(durationMinutes: number): { start: string; end: string } {
  const format = (totalMinutes: number) => {
    const normalized = ((totalMinutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  };
  const startMinutes = 18 * 60;
  return { start: format(startMinutes), end: format(startMinutes + durationMinutes) };
}

function doseFor(exercise: Record<string, unknown>): string {
  const sets = finiteInteger(exercise.sets);
  const reps = finiteInteger(exercise.reps);
  const duration = finiteInteger(exercise.duration_seconds);
  const rest = finiteInteger(exercise.rest_seconds);
  const parts: string[] = [];
  if (sets && reps) parts.push(`${sets}x${reps}`);
  else if (sets) parts.push(`${sets} series`);
  else if (reps) parts.push(`${reps} reps`);
  if (duration) parts.push(`${duration} s`);
  if (rest) parts.push(`descanso ${rest} s`);
  const load = exercise.load;
  if (isRecord(load) && typeof load.weight_kg === "number") parts.push(`${load.weight_kg} kg`);
  return parts.join(" · ");
}

function guidedPhase(phase: string): GuidedBlockPhase {
  const value = phase.toLowerCase();
  if (["prepare", "warmup", "calentamiento"].includes(value)) return "prepare";
  if (["cooldown", "prehab", "enfriamiento"].includes(value)) return "cooldown";
  if (["rest", "recovery", "descanso"].includes(value)) return "rest";
  if (["review", "revision", "revisión"].includes(value)) return "review";
  return "work";
}

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

function mediaFromContext(context: unknown, idPrefix: string): GuidedMedia[] {
  if (!isRecord(context) || !Array.isArray(context.media)) return [];
  return context.media.flatMap((item, index): GuidedMedia[] => {
    if (!isRecord(item)) return [];
    const label = text(item.label);
    const url = text(item.url);
    if (!label || !url) return [];
    const id = `${idPrefix}-media-${index + 1}`;
    if (url.startsWith("#")) return [{ id, kind: "internal", label, url }];
    const videoId = youtubeId(url);
    if (videoId) return [{ id, kind: "youtube", label, url, youtubeId: videoId }];
    if (url.startsWith("https://")) return [{ id, kind: "external", label, url }];
    return [];
  });
}

function readSessions(plan: Record<string, unknown>): Record<string, unknown>[] | null {
  if (!Array.isArray(plan.sessions)) return null;
  return plan.sessions.every(isRecord) ? plan.sessions : null;
}

export function resolveActivePlan(plan: unknown, schedule: PlanSchedule | null): PlanProjection {
  if (plan == null) return { status: "empty" };
  if (!isRecord(plan) || typeof plan.id !== "string" || !plan.id) return { status: "invalid" };
  const sessions = readSessions(plan);
  if (!sessions) return { status: "invalid" };
  if (!sessions.length) return { status: "empty" };
  if (!schedule) return { status: "invalid" };
  const ordered = [...sessions].sort((left, right) => (finiteInteger(left.position) ?? 0) - (finiteInteger(right.position) ?? 0));
  if (ordered.some((session) => typeof session.id !== "string" || !session.id || finiteInteger(session.scheduled_offset_days) === null)) {
    return { status: "invalid" };
  }
  const dates = scheduleOffsets(ordered.map((session) => finiteInteger(session.scheduled_offset_days) ?? 0), schedule);
  const exercisesBySessionId: ProjectedPlan["exercisesBySessionId"] = {};
  const guidedDefinitions: Record<string, GuidedSessionDefinition> = {};
  const placed: Array<{ date: string; week: number }> = [];
  const projected = ordered.map((session, index) => {
    const date = dates[index] ?? schedule.startDate;
    const week = Math.floor(daysBetween(schedule.startDate, date) / 7) + 1;
    const day = placed.filter((item) => item.week === week).length + 1;
    placed.push({ date, week });
    const blocks = Array.isArray(session.blocks) ? session.blocks.filter(isRecord) : [];
    const objective = text(session.objective, text(blocks[0]?.title, "Sesión"));
    const firstTitle = text(blocks[0]?.title, objective);
    const summedDuration = blocks.reduce((sum, block) => sum + (finiteInteger(block.duration_minutes) ?? 0), 0);
    const durationMinutes = finiteInteger(session.expected_duration_minutes) ?? (summedDuration || 45);
    const phase = text(session.phase, "Plan");
    const intensity = displayIntensity(text(session.intensity, "media"));
    const recovery = text(session.recovery_guidance);
    const drills = blocks.map((block) => {
      const title = text(block.title, "Bloque");
      const instructions = text(block.instructions);
      return instructions ? `${title}: ${instructions}` : title;
    });
    const exerciseLines = blocks.flatMap((block) => (Array.isArray(block.exercises) ? block.exercises.filter(isRecord) : []).map((exercise) => doseFor(exercise)).filter(Boolean));
    const subtitle = exerciseLines[0] || text(blocks[0]?.instructions) || objective;
    const clock = clockRange(durationMinutes);
    const view: ScheduledPlanSession = {
      id: session.id as string,
      planId: plan.id as string,
      position: finiteInteger(session.position) ?? index + 1,
      week,
      day,
      date,
      start: clock.start,
      end: clock.end,
      phase,
      type: phase,
      title: firstTitle,
      intensity,
      summary: objective,
      drills,
      durationMinutes,
      subtitle
    };
    exercisesBySessionId[view.id] = blocks.flatMap((block) => (Array.isArray(block.exercises) ? block.exercises.filter(isRecord) : []).map((exercise, exerciseIndex) => exerciseView(block, exercise, exerciseIndex)));
    guidedDefinitions[view.id] = guidedDefinition(view, blocks, recovery);
    return view;
  });
  return {
    status: "ready",
    plan: { planId: plan.id, sessions: projected, exercisesBySessionId, guidedDefinitions }
  };
}

function exerciseView(block: Record<string, unknown>, exercise: Record<string, unknown>, index: number): Exercise & { id: string } {
  const cues = stringList(exercise.cues);
  const dose = doseFor(exercise) || text(block.instructions, "Prescripción del plan");
  const refs = mediaFromContext(exercise.generator_context, text(exercise.id, `exercise-${index + 1}`)).map((media): ExerciseReference => ({
    label: media.label,
    source: media.kind === "youtube" ? "YouTube" : "Plan",
    url: media.url,
    image: ""
  }));
  return {
    id: text(exercise.id, `${text(block.id, "block")}-${index + 1}`),
    title: text(block.title, `Ejercicio ${index + 1}`),
    dose,
    rationale: text(block.instructions, dose),
    cues: cues.length ? cues : [text(block.instructions, dose)],
    avoid: "",
    refs
  };
}

function guidedDefinition(session: ScheduledPlanSession, blocks: Record<string, unknown>[], recovery: string): GuidedSessionDefinition {
  const guidedBlocks = blocks.map((block, index) => guidedBlock(session.id, block, index));
  if (!guidedBlocks.length) {
    guidedBlocks.push(guidedBlock(session.id, {
      id: `${session.id}-session`,
      phase: "work",
      title: session.title,
      instructions: session.summary,
      exercises: []
    }, 0));
  }
  return {
    sessionId: session.id,
    version: 1,
    objective: session.summary,
    safetyNote: recovery || SAFETY_NOTE,
    blocks: guidedBlocks
  };
}

function guidedBlock(sessionId: string, block: Record<string, unknown>, index: number): GuidedBlock {
  const blockId = text(block.id, `${sessionId}-block-${index + 1}`);
  const exercises = Array.isArray(block.exercises) ? block.exercises.filter(isRecord) : [];
  const title = text(block.title, `Bloque ${index + 1}`);
  const instructions = text(block.instructions, title);
  const sections = exercises.length ? exercises.map((exercise, exerciseIndex) => exerciseSection(blockId, block, exercise, exerciseIndex)) : [fallbackSection(blockId, title, instructions)];
  const cues = [...new Set(sections.flatMap((section) => section.cues))];
  const media = sections.flatMap((section) => section.media).map((item, mediaIndex) => ({ ...item, id: `${blockId}-media-${mediaIndex + 1}` }));
  const dose = sections.map((section) => section.rationale).find((value) => value && value !== instructions) || doseSummary(exercises) || instructions;
  return {
    id: blockId,
    phase: guidedPhase(text(block.phase, "work")),
    title,
    instruction: instructions,
    steps: cues.map((cue, cueIndex) => `${cueIndex + 1}. ${cue}`),
    dose,
    estimatedMinutes: finiteInteger(block.duration_minutes) ?? undefined,
    rationale: instructions,
    cues,
    equipment: [...new Set(sections.flatMap((section) => section.equipment))],
    media,
    exerciseSections: sections,
    narrationText: `${title}. ${instructions}`
  };
}

function doseSummary(exercises: Record<string, unknown>[]): string {
  return exercises.map((exercise) => doseFor(exercise)).filter(Boolean).join(" · ");
}

function exerciseSection(blockId: string, block: Record<string, unknown>, exercise: Record<string, unknown>, index: number): GuidedExerciseSection {
  const cues = stringList(exercise.cues);
  const instructions = text(block.instructions);
  const id = text(exercise.id, `${blockId}-exercise-${index + 1}`);
  return {
    id,
    title: text(block.title, `Ejercicio ${index + 1}`),
    rationale: doseFor(exercise) || instructions,
    cues: cues.length ? cues : [instructions || "Seguí la prescripción del plan."],
    equipment: [],
    media: mediaFromContext(exercise.generator_context, id)
  };
}

function fallbackSection(blockId: string, title: string, instructions: string): GuidedExerciseSection {
  return {
    id: `${blockId}-written`,
    title,
    rationale: instructions,
    cues: [instructions],
    equipment: [],
    media: []
  };
}

export function activePlanFromHydration(hydration: {
  activePlan?: ActivePlan | null;
  facts?: FactLike[] | null;
  currentProfile?: FactLike[] | null;
} | null | undefined): PlanProjection {
  if (!hydration) return { status: "empty" };
  const publishedAt = isRecord(hydration.activePlan) && typeof hydration.activePlan.published_at === "string" ? hydration.activePlan.published_at : null;
  return resolveActivePlan(hydration.activePlan ?? null, readPlanSchedule({
    facts: hydration.facts,
    currentProfile: hydration.currentProfile,
    publishedAt
  }));
}
