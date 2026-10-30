import { useMemo, useState } from "react";
import { Check, Clock3, Play } from "lucide-react";

import type { ScheduledPlanSession } from "./active-plan";

const WEEKDAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"] as const;

export type PlanNoticeStatus = "loading" | "empty" | "error";

interface PlanScreenProps {
  planId: string;
  sessions: ScheduledPlanSession[];
  completedSessionIds: ReadonlySet<string>;
  today: string;
  athleteInitials: string;
  resumeLabel?: string | null;
  onStartSession: (sessionId: string) => void;
  onResume?: () => void;
  onOpenProfile: () => void;
}

function parseIso(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(isoDate: string, days: number): string {
  const date = parseIso(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(isoDate: string): string {
  const weekday = parseIso(isoDate).getUTCDay();
  return addDays(isoDate, weekday === 0 ? -6 : 1 - weekday);
}

function weekdayName(isoDate: string): string {
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" }).format(parseIso(isoDate));
}

function dayHeading(isoDate: string, today: string): string {
  const weekday = weekdayName(isoDate);
  const day = parseIso(isoDate).getUTCDate();
  if (isoDate === today) return `Hoy · ${weekday} ${day}`;
  const month = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(parseIso(isoDate));
  return `${weekday} ${day} de ${month}`;
}

function sessionCountLabel(count: number): string {
  return count === 1 ? "1 sesión" : `${count} sesiones`;
}

export function ActivePlanNotice({ status, onRetry }: { status: PlanNoticeStatus; onRetry?: () => void }) {
  const copy = status === "loading"
    ? { title: "Cargando tu plan…", body: "Estamos leyendo las sesiones de tu plan activo." }
    : status === "error"
      ? { title: "No pudimos leer tu plan activo.", body: "El calendario de ejemplo no se usa en tu cuenta. Reintentá la carga." }
      : { title: "Todavía no tenés un plan activo.", body: "Cuando publiquemos tu plan, esta pantalla muestra esas sesiones." };
  return (
    <section className="plan-screen rounded-2xl px-5 py-8" role={status === "error" ? "alert" : "status"} data-testid="plan-notice" data-plan-status={status}>
      <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--plan-mid)] uppercase">Maillon</p>
      <h2 className="mt-2 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">{copy.title}</h2>
      <p className="mt-2 text-sm leading-snug text-[var(--plan-muted)]">{copy.body}</p>
      {status === "error" && onRetry ? (
        <button type="button" className="mt-5 h-11 rounded-lg bg-[var(--plan-deep)] px-4 text-base font-semibold text-[var(--plan-ground)]" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </section>
  );
}

export function PlanScreen({
  planId,
  sessions,
  completedSessionIds,
  today,
  athleteInitials,
  resumeLabel,
  onStartSession,
  onResume,
  onOpenProfile
}: PlanScreenProps) {
  const initialDay = useMemo(() => {
    const upcoming = sessions.find((session) => session.date >= today)?.date;
    return upcoming || sessions[0]?.date || today;
  }, [sessions, today]);
  const [selectedDate, setSelectedDate] = useState(initialDay);
  const weekStart = mondayOf(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, ScheduledPlanSession[]>();
    for (const session of [...sessions].sort((left, right) => left.position - right.position)) {
      const list = grouped.get(session.date) ?? [];
      list.push(session);
      grouped.set(session.date, list);
    }
    return grouped;
  }, [sessions]);
  const daySessions = sessionsByDate.get(selectedDate) ?? [];
  const nextSession = sessions.find((session) => !completedSessionIds.has(session.id) && session.date >= today)
    ?? sessions.find((session) => !completedSessionIds.has(session.id))
    ?? null;
  const focus = sessions.find((session) => session.date === selectedDate) ?? sessions.find((session) => session.date >= weekStart && session.date <= addDays(weekStart, 6)) ?? sessions[0];
  const overline = focus ? `Semana ${focus.week} · ${focus.phase}` : "Plan";

  return (
    <section className="plan-screen mx-auto w-full max-w-[420px]" data-testid="plan-screen" data-plan-id={planId}>
      <div className="flex h-14 items-center justify-between px-5">
        <p className="text-xl leading-tight font-extrabold tracking-[-0.02em]">Maillon</p>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full bg-[var(--plan-tint)] text-sm font-semibold text-[var(--plan-deep)]"
          onClick={onOpenProfile}
          aria-label="Abrir perfil"
        >
          {athleteInitials}
        </button>
      </div>
      <div className="space-y-6 px-5 pt-2 pb-4">
        <header className="space-y-1">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--plan-mid)] uppercase">{overline}</p>
          <h2 className="text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">Tu plan</h2>
        </header>
        {resumeLabel && onResume ? (
          <button type="button" className="flex h-11 w-full items-center justify-center rounded-lg border border-[var(--plan-mid)] bg-[var(--plan-tint)] px-4 text-sm font-semibold text-[var(--plan-deep)]" onClick={onResume}>
            {resumeLabel}
          </button>
        ) : null}
        <div className="flex gap-1.5" aria-label="Semana del plan">
          {weekDates.map((date) => {
            const selected = date === selectedDate;
            const daySessionsForDate = sessionsByDate.get(date) ?? [];
            const letter = WEEKDAY_LETTERS[(parseIso(date).getUTCDay() + 6) % 7];
            return (
              <button
                key={date}
                type="button"
                aria-pressed={selected}
                aria-label={`${letter} ${parseIso(date).getUTCDate()}`}
                onClick={() => setSelectedDate(date)}
                className={`flex h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border text-center ${selected ? "border-[var(--plan-mid)] bg-[var(--plan-tint)] text-[var(--plan-deep)]" : "border-transparent bg-[var(--plan-surface)] text-[var(--plan-ink)]"}`}
              >
                <span className={`text-[13px] ${selected ? "text-[var(--plan-deep)]" : "text-[var(--plan-muted)]"}`}>{letter}</span>
                <span className="text-base font-semibold">{parseIso(date).getUTCDate()}</span>
                <span
                  className={`size-1.5 rounded-full ${daySessionsForDate.length === 0 ? "bg-[var(--plan-line)]" : selected ? "bg-[var(--plan-deep)]" : "bg-[var(--plan-mid)]"}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold capitalize">{dayHeading(selectedDate, today)}</h3>
          <p className="text-sm text-[var(--plan-muted)]">{sessionCountLabel(daySessions.length)}</p>
        </div>
        <div className="space-y-3">
          {daySessions.length ? daySessions.map((session) => {
            const completed = completedSessionIds.has(session.id);
            const isNext = nextSession?.id === session.id;
            if (completed) {
              return (
                <article key={session.id} data-session-id={session.id} className="flex items-center gap-3 rounded-xl border border-[var(--plan-line)] px-4 py-3">
                  <span className="grid size-6 place-items-center rounded-full bg-[var(--plan-deep)] text-[var(--plan-ground)]" aria-hidden="true">
                    <Check className="size-3.5" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm text-[var(--plan-muted)]">{session.title} · hecha</p>
                  <p className="text-sm text-[var(--plan-faint)]">{session.durationMinutes} min</p>
                </article>
              );
            }
            return (
              <article
                key={session.id}
                data-session-id={session.id}
                className={`space-y-3 rounded-xl p-4 ${isNext ? "border border-[var(--plan-mid)] bg-[var(--plan-ground)]" : "bg-[var(--plan-surface)]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-base font-semibold">{session.title}</h4>
                    <p className="mt-1 text-sm text-[var(--plan-muted)]">{session.subtitle}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm ${isNext ? "border border-[var(--plan-mid)] bg-[var(--plan-tint)] text-[var(--plan-deep)]" : "border border-[var(--plan-line)] bg-[var(--plan-ground)] text-[var(--plan-muted)]"}`}>
                    {isNext ? "Siguiente" : "Pendiente"}
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-[var(--plan-muted)]">
                  <Clock3 className="size-4" aria-hidden="true" />
                  {session.durationMinutes} min
                </p>
                {isNext ? (
                  <button
                    type="button"
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--plan-deep)] px-4 text-base font-semibold text-[var(--plan-ground)]"
                    onClick={() => onStartSession(session.id)}
                  >
                    <Play className="size-4 fill-current" aria-hidden="true" />
                    Empezar sesión
                  </button>
                ) : (
                  <button type="button" className="text-sm font-semibold text-[var(--plan-deep)]" onClick={() => onStartSession(session.id)}>
                    Ver sesión
                  </button>
                )}
              </article>
            );
          }) : (
            <p className="rounded-xl bg-[var(--plan-surface)] px-4 py-3 text-sm text-[var(--plan-muted)]">No hay sesiones este día.</p>
          )}
        </div>
      </div>
    </section>
  );
}
