import { useState } from "react";
import { Check, GripVertical, Play } from "lucide-react";

import type { ScheduledPlanSession } from "./active-plan";
import {
  buildWeekPlan,
  emptyPlanWeekEdits,
  moveSession,
  skipSession,
  swapToMobility,
  undoSkip,
  undoSwap,
  type PlanWeekEdits
} from "../p0/plan-week";

export type PlanNoticeStatus = "loading" | "empty" | "error";

interface PlanScreenProps {
  planId: string;
  sessions: ScheduledPlanSession[];
  completedSessionIds: ReadonlySet<string>;
  today: string;
  athleteInitials: string;
  resumeLabel?: string | null;
  edits?: PlanWeekEdits;
  recentPain?: number;
  onEditsChange?: (edits: PlanWeekEdits) => void;
  onStartSession: (sessionId: string) => void;
  onOpenLogger?: (sessionId: string) => void;
  onResume?: () => void;
  onOpenProfile: () => void;
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
  edits,
  recentPain = 0,
  onEditsChange,
  onStartSession,
  onOpenLogger,
  onResume,
  onOpenProfile
}: PlanScreenProps) {
  const [localEdits, setLocalEdits] = useState(edits ?? emptyPlanWeekEdits());
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const currentEdits = edits ?? localEdits;
  const view = buildWeekPlan({ sessions, edits: currentEdits, today, completedSessionIds, recentPain });

  function commit(next: PlanWeekEdits) {
    setLocalEdits(next);
    onEditsChange?.(next);
  }

  function startFeatured() {
    if (!view.featured) return;
    if (view.featured.mobility) {
      onOpenLogger?.(view.featured.planSessionId);
      return;
    }
    onStartSession(view.featured.planSessionId);
  }

  function moveTo(sessionId: string, date: string) {
    commit(moveSession(currentEdits, sessionId, date));
    setMovingId(null);
  }

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
      <div className="space-y-4 px-5 pt-2 pb-8">
        <header className="space-y-1">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--plan-mid)] uppercase">{view.overline}</p>
          <h2 className="text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">Esta semana</h2>
        </header>
        {resumeLabel && onResume ? (
          <button type="button" className="flex h-11 w-full items-center justify-center rounded-lg border border-[var(--plan-mid)] bg-[var(--plan-tint)] px-4 text-sm font-semibold text-[var(--plan-deep)]" onClick={onResume}>
            {resumeLabel}
          </button>
        ) : null}
        {view.featured ? (
          <article className={`space-y-3 rounded-2xl p-4 ${view.featured.completed || view.featured.skipped ? "border border-[var(--plan-line)] bg-[var(--plan-surface)]" : "bg-[var(--plan-deep)] text-[var(--plan-ground)]"}`}>
            <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${view.featured.completed || view.featured.skipped ? "text-[var(--plan-mid)]" : "text-[#d5ddd8]"}`}>{view.featured.dateLabel}</p>
            <div>
              <h3 className="text-xl font-bold tracking-[-0.02em]">{view.featured.completed ? `${view.featured.title} · hecha` : view.featured.title}</h3>
              <p className={`mt-1 text-sm ${view.featured.completed || view.featured.skipped ? "text-[var(--plan-muted)]" : "text-[#d5ddd8]"}`}>
                {view.featured.skipped ? "Saltaste esta sesión. Podés deshacerlo y entrenar igual." : view.featured.detail}
              </p>
            </div>
            {view.featured.canStart ? (
              <div className="flex gap-2">
                <button type="button" className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--plan-ground)] px-4 text-base font-semibold text-[var(--plan-ink)]" onClick={startFeatured}>
                  <Play className="size-4 fill-current" aria-hidden="true" />
                  Empezar
                </button>
                {view.featured.canSkip ? (
                  <button type="button" className="h-11 rounded-lg border border-[#d5ddd8]/40 px-4 text-base font-semibold" onClick={() => commit(skipSession(currentEdits, view.featured!.planSessionId))}>
                    Saltar
                  </button>
                ) : null}
              </div>
            ) : null}
            {view.featured.skipped ? (
              <button type="button" className="text-sm font-semibold text-[var(--plan-deep)]" onClick={() => commit(undoSkip(currentEdits, view.featured!.planSessionId))}>
                Deshacer
              </button>
            ) : null}
            {view.featured.completed ? (
              <span className="grid size-6 place-items-center rounded-full bg-[var(--plan-deep)] text-[var(--plan-ground)]" aria-hidden="true">
                <Check className="size-3.5" />
              </span>
            ) : null}
          </article>
        ) : (
          <p className="rounded-xl bg-[var(--plan-surface)] px-4 py-3 text-sm text-[var(--plan-muted)]">Esta semana no tiene sesiones.</p>
        )}
        {view.featured?.mobility ? (
          <button type="button" className="text-sm font-semibold text-[var(--plan-deep)]" onClick={() => commit(undoSwap(currentEdits, view.featured!.planSessionId))}>
            Deshacer el cambio a movilidad
          </button>
        ) : null}
        {view.showPainGuard ? (
          <aside className={`space-y-2 rounded-2xl px-4 py-3 ${view.painHigh ? "bg-[#f3e4c8]" : "bg-[var(--plan-warn)]"}`}>
            <p className="text-sm font-semibold">{view.painHigh ? "El dolor de dedos está alto" : "¿Dolor en dedos hoy?"}</p>
            <p className="text-sm leading-snug text-[var(--plan-ink)]">Cambiá a movilidad (20 min) y movemos fuerza al jueves. La semana se reajusta sola.</p>
            <button
              type="button"
              className="h-10 rounded-full border border-[var(--plan-ink)]/15 bg-[var(--plan-ground)] px-4 text-sm font-semibold"
              onClick={() => view.featured && commit(swapToMobility(currentEdits, view.featured.planSessionId, view.featured.date))}
            >
              Dolor → cambiar a movilidad
            </button>
          </aside>
        ) : null}
        {view.rows.length ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">Siguiente</h3>
              <p className="text-sm text-[var(--plan-muted)]">Arrastrá para mover</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--plan-line)]">
              {view.rows.map((row) => (
                <div key={row.sessionId} className="border-b border-[var(--plan-line)] last:border-b-0" data-session-id={row.planSessionId}>
                  <div
                    draggable={row.movable}
                    onDragStart={() => setDraggedId(row.planSessionId)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedId) moveTo(draggedId, row.date);
                      setDraggedId(null);
                    }}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <GripVertical className="size-4 shrink-0 text-[var(--plan-faint)]" aria-hidden="true" />
                    <div className="w-12 shrink-0">
                      <p className="text-[11px] font-semibold tracking-wide text-[var(--plan-muted)]">{row.weekday}</p>
                      <p className="text-sm font-semibold">{row.dayNumber}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.title}</p>
                      <p className="truncate text-sm text-[var(--plan-muted)]">{row.detail}</p>
                    </div>
                    {row.badge ? (
                      <span className="rounded-full bg-[var(--plan-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--plan-deep)]">{row.badge}</span>
                    ) : row.movable ? (
                      <button type="button" className="text-sm font-semibold text-[var(--plan-mid)]" aria-expanded={movingId === row.sessionId} onClick={() => setMovingId(movingId === row.sessionId ? null : row.sessionId)}>
                        Mover
                      </button>
                    ) : null}
                  </div>
                  {movingId === row.sessionId ? (
                    <div className="flex gap-1 px-3 pb-3" role="group" aria-label={`Día para ${row.title}`}>
                      {view.weekDates.map((date) => (
                        <button key={date} type="button" className={`h-8 flex-1 rounded-md text-xs font-semibold ${date === row.date ? "bg-[var(--plan-deep)] text-[var(--plan-ground)]" : "bg-[var(--plan-surface)]"}`} onClick={() => moveTo(row.planSessionId, date)}>
                          {date.slice(8)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {view.earlierNote ? <p className="text-center text-sm text-[var(--plan-muted)]">{view.earlierNote}</p> : null}
      </div>
    </section>
  );
}
