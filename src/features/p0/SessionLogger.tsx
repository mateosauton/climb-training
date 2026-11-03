import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { ScheduledPlanSession } from "../plan/active-plan";
import type { LoggerDraft } from "./plan-week";

interface SessionLoggerProps {
  draft: LoggerDraft;
  sessions: ScheduledPlanSession[];
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
  onSessionChange: (sessionId: string) => void;
  onSave: (values: LoggerSaveValues) => void;
  onOpenProgress: () => void;
  onBack: () => void;
}

export interface LoggerSaveValues {
  planSessionId: string;
  mobility: boolean;
  rpe: number;
  pain: number;
  attempts: number;
  bestLink: number | null;
  footCuts: number | null;
  notes: string;
}

export function SessionLogger({ draft, sessions, status, message, onSessionChange, onSave, onOpenProgress, onBack }: SessionLoggerProps) {
  const [rpe, setRpe] = useState(draft.rpe);
  const [pain, setPain] = useState(draft.pain);
  const [attempts, setAttempts] = useState(draft.attempts);
  const [bestLink, setBestLink] = useState<number | null>(draft.bestLink);
  const [footCuts, setFootCuts] = useState<number | null>(draft.footCuts);
  const [notes, setNotes] = useState(draft.notes);
  const [showOptional, setShowOptional] = useState(false);
  const draftKey = `${draft.sessionId}:${draft.rpe}:${draft.pain}:${draft.attempts}`;
  const [seenKey, setSeenKey] = useState(draftKey);
  if (seenKey !== draftKey) {
    setSeenKey(draftKey);
    setRpe(draft.rpe);
    setPain(draft.pain);
    setAttempts(draft.attempts);
    setBestLink(draft.bestLink);
    setFootCuts(draft.footCuts);
    setNotes(draft.notes);
  }

  const ready = [draft.sessionId, rpe, pain, attempts].every((value) => value !== null && value !== undefined);

  return (
    <section className="plan-screen mx-auto flex min-h-[640px] w-full max-w-[420px] flex-col" data-testid="session-logger">
      <div className="flex h-14 items-center gap-2 px-3">
        <button type="button" className="grid size-9 place-items-center rounded-full bg-[var(--plan-surface)]" onClick={onBack} aria-label="Volver al plan">
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="text-lg font-bold tracking-[-0.02em]">Registrar sesión</h2>
      </div>
      {status === "saved" ? (
        <div className="space-y-4 px-5 py-6">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--plan-mid)] uppercase">Sesiones</p>
          <h3 className="text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">Sesión guardada</h3>
          <p className="text-sm text-[var(--plan-muted)]">Quedó en tu historial. El progreso ya puede leer link, foot-cuts, RPE y dolor.</p>
          {message ? <p className="text-sm text-[var(--plan-muted)]">{message}</p> : null}
          <button type="button" className="h-12 w-full rounded-xl bg-[var(--plan-deep)] text-base font-semibold text-[var(--plan-ground)]" onClick={onOpenProgress}>
            Ver progreso
          </button>
        </div>
      ) : (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ planSessionId: draft.planSessionId, mobility: draft.mobility, rpe, pain, attempts, bestLink, footCuts, notes: notes.trim() });
          }}
        >
          <div className="space-y-4 px-5 pb-4">
            <label className="block rounded-xl bg-[var(--plan-surface)] px-4 py-3">
              <span className="text-xs text-[var(--plan-muted)]">Sesión</span>
              <span className="mt-1 flex items-center gap-2">
                <select
                  aria-label="Sesión"
                  className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
                  value={draft.planSessionId}
                  onChange={(event) => onSessionChange(event.target.value)}
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.title}</option>
                  ))}
                </select>
                <ChevronRight className="size-4 text-[var(--plan-faint)]" aria-hidden="true" />
              </span>
              <span className="mt-1 block text-sm text-[var(--plan-muted)]">{draft.label} · {draft.dateLabel}</span>
            </label>
            <p className="rounded-xl bg-[var(--plan-tint)] px-4 py-3 text-sm leading-snug text-[var(--plan-deep)]">✓ {draft.prefillNote}</p>
            <Scale label="Esfuerzo percibido (RPE)" hint={`${rpe} · ${draft.rpeHint}`} min={1} max={10} value={rpe} onChange={setRpe} />
            <Scale label="Dolor en dedos" hint={`${pain} / 10 · ${draft.painHint}`} min={0} max={10} value={pain} onChange={setPain} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Intentos</p>
                <p className="text-sm text-[var(--plan-muted)]">Plan: {draft.doseLabel}</p>
              </div>
              <Stepper label="Intentos" value={attempts} min={0} max={200} onChange={setAttempts} />
            </div>
            <button type="button" className="text-sm font-semibold text-[var(--plan-deep)]" onClick={() => setShowOptional((open) => !open)} aria-expanded={showOptional}>
              {showOptional ? "Ocultar opcionales" : "Opcional · mejor link, foot-cuts y notas"}
            </button>
            {showOptional ? (
              <div className="space-y-3 rounded-xl border border-[var(--plan-line)] px-4 py-3">
                <OptionalStepper label="Mejor link" hint="movimientos continuos" value={bestLink} max={500} onChange={setBestLink} />
                <OptionalStepper label="Foot-cuts" hint="cortes de pie" value={footCuts} max={200} onChange={setFootCuts} />
                <label className="block text-sm font-semibold">
                  Notas
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Añadir nota · opcional" className="mt-2 w-full resize-none rounded-lg border border-[var(--plan-line)] bg-[var(--plan-ground)] px-3 py-2 text-sm font-normal outline-none" />
                </label>
              </div>
            ) : null}
            {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
          </div>
          <div className="mt-auto space-y-2 px-5 pt-6 pb-4">
            <button type="submit" className="h-12 w-full rounded-xl bg-[var(--plan-deep)] text-base font-semibold text-[var(--plan-ground)] disabled:opacity-60" disabled={status === "saving" || !ready}>
              {status === "saving" ? "Guardando…" : "Guardar sesión"}
            </button>
            <p className="text-center text-xs text-[var(--plan-muted)]">{ready ? "4 de 4 campos listos · ~15 s" : "Completá la sesión, el RPE, el dolor y los intentos"}</p>
          </div>
        </form>
      )}
    </section>
  );
}

function Scale({ label, hint, min, max, value, onChange }: { label: string; hint: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  const points = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return (
    <fieldset>
      <legend className="flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
        {label}
        <span className="text-xs font-normal text-[var(--plan-muted)]">{hint}</span>
      </legend>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={label}>
        {points.map((point) => {
          const selected = point === value;
          return (
            <button
              key={point}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`grid h-9 min-w-0 flex-1 place-items-center rounded-lg text-sm font-semibold ${selected ? "bg-[var(--plan-deep)] text-[var(--plan-ground)]" : "bg-[var(--plan-surface)] text-[var(--plan-ink)]"}`}
              onClick={() => onChange(point)}
            >
              {point}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <button type="button" className="grid size-9 place-items-center rounded-lg bg-[var(--plan-surface)] text-lg" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Bajar ${label}`}>−</button>
      <span className="w-8 text-center text-base font-semibold tabular-nums">{value}</span>
      <button type="button" className="grid size-9 place-items-center rounded-lg bg-[var(--plan-surface)] text-lg" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Subir ${label}`}>+</button>
    </div>
  );
}

function OptionalStepper({ label, hint, value, max, onChange }: { label: string; hint: string; value: number | null; max: number; onChange: (value: number | null) => void }) {
  const shown = value ?? 0;
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-[var(--plan-muted)]">{value === null ? `${hint} · opcional` : hint}</p>
      </div>
      <Stepper
        label={label}
        value={shown}
        min={0}
        max={max}
        onChange={(next) => onChange(next)}
      />
    </div>
  );
}
