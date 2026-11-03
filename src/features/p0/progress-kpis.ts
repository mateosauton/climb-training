import { addUtcDays } from "../plan/active-plan";
import type { SessionLog } from "../../lib/training";

export interface KpiCardModel {
  id: "bestLink" | "footCuts" | "rpe" | "pain";
  label: string;
  value: string;
  delta: string;
  points: number[];
}

export interface ProgressWeek {
  label: string;
  bestLink: number;
  footCuts: number;
  rpe: number;
  pain: number;
  sessions: number;
}

export interface ProgressModel {
  hasLogs: boolean;
  cards: KpiCardModel[];
  readingTitle: string;
  reading: string;
  weeks: ProgressWeek[];
}

type LogSlice = Pick<SessionLog, "createdAt" | "bestLink" | "footCuts" | "rpe" | "pain">;

export function buildProgress(logs: readonly LogSlice[], today: string): ProgressModel {
  const starts = lastFourMondays(today);
  const weeks = starts.map((start, index) => summarizeWeek(logs, start, addUtcDays(start, 7), `S${index + 1}`));
  const hasLogs = logs.length > 0;
  const latest = [...weeks].reverse().find((week) => week.sessions > 0) ?? weeks[weeks.length - 1];
  const baseline = weeks.find((week) => week.sessions > 0) ?? weeks[0];
  const cards: KpiCardModel[] = [
    {
      id: "bestLink",
      label: "Mejor link",
      value: hasLogs && latest.bestLink > 0 ? `${Math.round(latest.bestLink)} movs` : "—",
      delta: hasLogs && latest.bestLink > 0 ? countDelta(latest.bestLink, baseline.bestLink) : "sin datos",
      points: weeks.map((week) => week.bestLink)
    },
    {
      id: "footCuts",
      label: "Foot-cuts",
      value: hasLogs ? `${formatNumber(latest.footCuts)} / sesión` : "—",
      delta: hasLogs ? countDelta(latest.footCuts, baseline.footCuts) : "sin datos",
      points: weeks.map((week) => week.footCuts)
    },
    {
      id: "rpe",
      label: "RPE medio",
      value: hasLogs ? formatNumber(latest.rpe) : "—",
      delta: hasLogs ? trendWord(latest.rpe - baseline.rpe) : "sin datos",
      points: weeks.map((week) => week.rpe)
    },
    {
      id: "pain",
      label: "Dolor dedos",
      value: hasLogs ? `${formatNumber(latest.pain)} / 10` : "—",
      delta: hasLogs ? trendWord(latest.pain - baseline.pain, true) : "sin datos",
      points: weeks.map((week) => week.pain)
    }
  ];
  return {
    hasLogs,
    cards,
    readingTitle: "Lectura de la semana",
    reading: readingFor(latest, baseline, hasLogs),
    weeks
  };
}

function readingFor(latest: ProgressWeek, baseline: ProgressWeek, hasLogs: boolean): string {
  if (!hasLogs) return "Cuando registres una sesión, vas a ver el link, los foot-cuts, el RPE y el dolor de las últimas 4 semanas.";
  if (latest.sessions === 0) return "Esta semana todavía no tiene sesiones. Las cuatro semanas anteriores siguen acá cuando haya registros.";
  if (latest.bestLink === 0) return "Registrá el mejor link y los foot-cuts para leer la tendencia. El RPE y el dolor ya quedan en la sesión.";
  if (latest.pain > 2) return "El dolor está alto. Bajá la carga o cambiá el día duro por movilidad.";
  const linkUp = latest.bestLink > baseline.bestLink;
  const cutsDown = latest.footCuts < baseline.footCuts;
  if (linkUp && cutsDown) return "Más movimientos enlazados con menos foot-cuts: tus pies mejoran. Dolor bajo, mantené la carga.";
  if (linkUp) return "El link viene subiendo. Mantené la calidad de los pies.";
  if (cutsDown) return "Menos foot-cuts que al principio. Seguí registrando el link para ver si se sostiene.";
  return "La carga viene pareja. Seguí registrando para leer la tendencia con más sesiones.";
}

function summarizeWeek(logs: readonly LogSlice[], start: string, end: string, label: string): ProgressWeek {
  const bucket = logs.filter((log) => {
    const day = log.createdAt.slice(0, 10);
    return day >= start && day < end;
  });
  const bestLinks = bucket.map((log) => log.bestLink).filter((value) => value > 0);
  return {
    label,
    bestLink: bestLinks.length ? Math.max(...bestLinks) : 0,
    footCuts: average(bucket.map((log) => log.footCuts)),
    rpe: average(bucket.map((log) => log.rpe)),
    pain: average(bucket.map((log) => log.pain)),
    sessions: bucket.length
  };
}

function lastFourMondays(today: string): string[] {
  const weekday = utcWeekday(today);
  const monday = addUtcDays(today, weekday === 0 ? -6 : 1 - weekday);
  return [3, 2, 1, 0].map((weeksAgo) => addUtcDays(monday, -7 * weeksAgo));
}

function countDelta(current: number, baseline: number): string {
  const diff = current - baseline;
  if (Math.abs(diff) < 0.5) return "estable";
  const sign = diff > 0 ? "+" : "−";
  const rounded = Math.abs(diff) >= 10 || Number.isInteger(diff) ? String(Math.round(Math.abs(diff))) : formatNumber(Math.abs(diff));
  return `${sign}${rounded} vs. S1`;
}

function trendWord(diff: number, pain = false): string {
  if (diff <= -0.5) return pain ? "bajando" : "bajando";
  if (diff >= 0.5) return "subiendo";
  return "estable";
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function utcWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
