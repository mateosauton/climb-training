import type { SessionLog } from "@/lib/training";

export type TrainingLoad = "Sin datos" | "Baja" | "Moderada" | "Alta";

const DAY_MS = 24 * 60 * 60 * 1000;
const frenchGrades = [
  "4a", "4a+", "4b", "4b+", "4c", "4c+",
  "5a", "5a+", "5b", "5b+", "5c", "5c+",
  "6a", "6a+", "6b", "6b+", "6c", "6c+",
  "7a", "7a+", "7b", "7b+", "7c", "7c+",
  "8a", "8a+", "8b", "8b+", "8c", "8c+",
  "9a", "9a+", "9b", "9b+", "9c"
];

function weekStart(date: Date): number {
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return localMidnight - daysSinceMonday * DAY_MS;
}

function logsInWeek(logs: SessionLog[], now: Date): SessionLog[] {
  const start = weekStart(now);
  const end = start + 7 * DAY_MS;
  return logs.filter((entry) => {
    const timestamp = Date.parse(entry.createdAt);
    return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
  });
}

export function formatAgeLocation(age: string, location: string): string {
  const parts: string[] = [];
  const normalizedAge = age.trim();
  const normalizedLocation = location.trim();
  if (normalizedAge) parts.push(`${normalizedAge} años`);
  if (normalizedLocation) parts.push(normalizedLocation);
  return parts.join(" · ");
}

export function calculateCurrentWeekSessions(logs: SessionLog[], now: Date): number {
  return logsInWeek(logs, now).length;
}

export function calculateWeeklyStreak(logs: SessionLog[], now: Date): number {
  const activeWeeks = new Set(
    logs
      .map((entry) => new Date(entry.createdAt))
      .filter((date) => Number.isFinite(date.getTime()))
      .map(weekStart)
  );
  const current = weekStart(now);
  let streak = 0;
  while (activeWeeks.has(current - streak * 7 * DAY_MS)) streak += 1;
  return streak;
}

export function calculateTrainingLoad(logs: SessionLog[], now: Date): TrainingLoad {
  const currentLogs = logsInWeek(logs, now);
  if (currentLogs.length === 0) return "Sin datos";
  const workload = currentLogs.reduce(
    (total, entry) => total + Math.max(0, entry.rpe) * (Math.max(0, entry.moves) + Math.max(0, entry.attempts) * 3),
    0
  );
  if (workload < 300) return "Baja";
  if (workload < 1200) return "Moderada";
  return "Alta";
}

type NormalizedGrade = { system: "v" | "french"; score: number };

function normalizeGrade(value: string): NormalizedGrade | null {
  const candidates = value.toLowerCase().split("/").map((candidate) => candidate.trim()).filter(Boolean);
  const normalized = candidates.flatMap((candidate): NormalizedGrade[] => {
    const vMatch = candidate.match(/^v(\d{1,2})$/);
    if (vMatch) return [{ system: "v", score: Number(vMatch[1]) }];
    const frenchIndex = frenchGrades.indexOf(candidate);
    return frenchIndex >= 0 ? [{ system: "french", score: frenchIndex + 1 }] : [];
  });
  if (normalized.length === 0) return null;
  const system = normalized[0].system;
  const comparable = normalized.filter((grade) => grade.system === system);
  return comparable.reduce((highest, grade) => grade.score > highest.score ? grade : highest);
}

export function calculateGradeProgress(currentGrade: string, targetGrade: string): number | null {
  const current = normalizeGrade(currentGrade);
  const target = normalizeGrade(targetGrade);
  if (!current || !target || current.system !== target.system || target.score <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((current.score / target.score) * 100)));
}
