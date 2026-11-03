import { useState } from "react";
import { ChevronRight } from "lucide-react";

import type { SessionLog } from "../../lib/training";
import {
  ANCHOR_PROTOCOLS,
  buildAnchorHistory,
  formatAnchorDelta,
  formatAnchorResult,
  parseAnchorDraft,
  type AnchorDraft,
  type AnchorPoint,
  type AnchorProtocolId
} from "./anchor-tests";
import { buildProgress } from "./progress-kpis";

const BAR_COLORS = ["#e6e1db", "#d4cdc4", "#6b7d72", "#354a40"] as const;

interface ProgressDashboardProps {
  logs: readonly Pick<SessionLog, "id" | "sessionId" | "createdAt" | "notes" | "moves" | "pullWeight" | "bestLink" | "footCuts" | "rpe" | "pain">[];
  today: string;
  athleteInitials: string;
  onOpenProfile: () => void;
  onSaveAnchor: (draft: AnchorDraft) => void;
  anchorStatus: "idle" | "saving" | "saved" | "error";
  anchorMessage?: string;
}

export function ProgressDashboard({ logs, today, athleteInitials, onOpenProfile, onSaveAnchor, anchorStatus, anchorMessage = "" }: ProgressDashboardProps) {
  const model = buildProgress(logs, today);
  const history = buildAnchorHistory(logs, today);
  const [detailOpen, setDetailOpen] = useState(false);
  const initialProtocol = history.points[0]?.protocol ?? "hang-20mm";
  const [protocol, setProtocol] = useState<AnchorProtocolId>(initialProtocol);
  const [setup, setSetup] = useState(history.schedules[initialProtocol].suggestedSetup);
  const [result, setResult] = useState("");
  const [formError, setFormError] = useState("");
  const anchorKey = history.points.map((point) => `${point.id}:${point.setup}`).join("|");
  const [seenAnchors, setSeenAnchors] = useState(anchorKey);
  if (seenAnchors !== anchorKey) {
    const nextProtocol = history.points[0]?.protocol ?? protocol;
    setSeenAnchors(anchorKey);
    setProtocol(nextProtocol);
    setSetup(history.schedules[nextProtocol].suggestedSetup);
    setResult("");
    setFormError("");
  }
  const spec = ANCHOR_PROTOCOLS[protocol];
  const schedule = history.schedules[protocol];

  return (
    <section className="plan-screen mx-auto w-full max-w-[420px]" data-testid="progress-dashboard">
      <div className="flex h-14 items-center justify-between px-5">
        <p className="text-xl leading-tight font-extrabold tracking-[-0.02em]">Maillon</p>
        <button type="button" className="grid size-9 place-items-center rounded-full bg-[var(--plan-tint)] text-sm font-semibold text-[var(--plan-deep)]" onClick={onOpenProfile} aria-label="Abrir perfil">
          {athleteInitials}
        </button>
      </div>
      <div className="space-y-4 px-5 pt-2 pb-8">
        <header className="space-y-1">
          <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--plan-mid)] uppercase">Últimas 4 semanas</p>
          <h2 className="text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">Progreso</h2>
        </header>
        <div className="grid grid-cols-2 gap-3">
          {model.cards.map((card) => (
            <article key={card.id} className="space-y-2 rounded-2xl border border-[var(--plan-line)] bg-[var(--plan-ground)] p-3" data-kpi={card.id}>
              <p className="text-xs text-[var(--plan-muted)]">{card.label}</p>
              <p className="text-[28px] leading-none font-bold tracking-[-0.03em]">{card.value}</p>
              <p className="text-xs text-[var(--plan-muted)]">{card.delta}</p>
              <Sparkline points={card.points} label={card.label} />
              <div className="flex justify-between text-[10px] font-semibold tracking-wide text-[var(--plan-faint)]">
                {model.weeks.map((week) => <span key={week.label}>{week.label}</span>)}
              </div>
            </article>
          ))}
        </div>
        <aside className="rounded-2xl bg-[var(--plan-tint)] px-4 py-3">
          <p className="text-sm font-semibold">{model.readingTitle}</p>
          <p className="mt-1 text-sm leading-snug text-[var(--plan-ink)]">{model.reading}</p>
        </aside>
        <AnchorTestForm
          protocol={protocol}
          setup={setup}
          result={result}
          scheduleCopy={schedule.copy}
          instructions={spec.instructions}
          setupLabel={spec.setupLabel}
          resultLabel={spec.resultLabel}
          integer={spec.integer}
          min={spec.min}
          max={spec.max}
          points={history.points}
          status={anchorStatus}
          message={anchorStatus === "error" || anchorStatus === "saved" ? anchorMessage : ""}
          formError={formError}
          onProtocol={(next) => {
            setProtocol(next);
            setSetup(history.schedules[next].suggestedSetup);
            setResult("");
            setFormError("");
          }}
          onSetup={(value) => {
            setSetup(value);
            setFormError("");
          }}
          onResult={(value) => {
            setResult(value);
            setFormError("");
          }}
          onSubmit={() => {
            const parsed = parseAnchorDraft({ protocol, result, setup });
            if (parsed.ok === false) {
              setFormError(parsed.message);
              return;
            }
            onSaveAnchor(parsed.draft);
          }}
        />
        <button type="button" className="flex items-center gap-1 text-sm font-semibold" onClick={() => setDetailOpen((open) => !open)} aria-expanded={detailOpen}>
          Ver detalle por semana
          <ChevronRight className={`size-4 transition ${detailOpen ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
        {detailOpen ? (
          <div className="space-y-2">
            {model.weeks.map((week) => (
              <div key={week.label} className="rounded-xl border border-[var(--plan-line)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{week.label}</p>
                  <p className="text-[var(--plan-muted)]">{week.sessions === 1 ? "1 sesión" : `${week.sessions} sesiones`}</p>
                </div>
                <p className="mt-1 text-[var(--plan-muted)]">Link {week.bestLink || "—"} · foot-cuts {week.footCuts || "—"} · RPE {week.rpe || "—"} · dolor {week.pain || "—"}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AnchorTestForm({
  protocol,
  setup,
  result,
  scheduleCopy,
  instructions,
  setupLabel,
  resultLabel,
  integer,
  min,
  max,
  points,
  status,
  message,
  formError,
  onProtocol,
  onSetup,
  onResult,
  onSubmit
}: {
  protocol: AnchorProtocolId;
  setup: string;
  result: string;
  scheduleCopy: string;
  instructions: string;
  setupLabel: string;
  resultLabel: string;
  integer: boolean;
  min: number;
  max: number;
  points: readonly AnchorPoint[];
  status: "idle" | "saving" | "saved" | "error";
  message: string;
  formError: string;
  onProtocol: (protocol: AnchorProtocolId) => void;
  onSetup: (value: string) => void;
  onResult: (value: string) => void;
  onSubmit: () => void;
}) {
  const protocols = Object.values(ANCHOR_PROTOCOLS);
  return (
    <form
      className="space-y-3 rounded-2xl border border-[var(--plan-line)] bg-[var(--plan-ground)] p-4"
      data-testid="anchor-tests"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-bold tracking-[0.08em] text-[var(--plan-mid)] uppercase">Cada 4 semanas</p>
        <h3 className="text-lg font-bold tracking-[-0.02em]">Test de ancla</h3>
        <p className="text-sm leading-snug text-[var(--plan-ink)]">{scheduleCopy}</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="sr-only">Protocolo</legend>
        <div className="grid grid-cols-2 gap-2">
          {protocols.map((item) => (
            <label key={item.id} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${protocol === item.id ? "border-[var(--plan-deep)] bg-[var(--plan-tint)]" : "border-[var(--plan-line)]"}`}>
              <input
                className="sr-only"
                type="radio"
                name="anchor-protocol"
                value={item.id}
                checked={protocol === item.id}
                onChange={() => onProtocol(item.id)}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm leading-snug text-[var(--plan-muted)]">{instructions}</p>
      <label className="block text-xs text-[var(--plan-muted)]">
        {setupLabel}
        <input
          value={setup}
          onChange={(event) => onSetup(event.target.value)}
          maxLength={80}
          className="mt-1 w-full rounded-lg border border-[var(--plan-line)] bg-[var(--plan-surface)] px-3 py-2 text-sm text-[var(--plan-ink)] outline-none"
        />
      </label>
      <label className="block text-xs text-[var(--plan-muted)]">
        {resultLabel}
        <input
          value={result}
          onChange={(event) => onResult(event.target.value)}
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={integer ? 1 : 0.5}
          className="mt-1 w-full rounded-lg border border-[var(--plan-line)] bg-[var(--plan-surface)] px-3 py-2 text-sm text-[var(--plan-ink)] outline-none"
        />
      </label>
      {formError ? <p role="alert" className="text-sm text-[var(--plan-ink)]">{formError}</p> : null}
      {message ? <p className="text-sm text-[var(--plan-muted)]">{message}</p> : null}
      <button type="submit" className="h-12 w-full rounded-xl bg-[var(--plan-deep)] text-base font-semibold text-[var(--plan-ground)] disabled:opacity-60" disabled={status === "saving"}>
        Guardar ancla
      </button>
      {points.length ? (
        <ol className="space-y-2">
          {points.map((point) => (
            <li key={point.id} className="rounded-xl border border-[var(--plan-line)] px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{ANCHOR_PROTOCOLS[point.protocol].label}</p>
                <p>{formatAnchorResult(point.protocol, point.result)}</p>
              </div>
              <p className="mt-1 text-[var(--plan-muted)]">{formatDay(point.recordedOn)} · {point.setup}</p>
              <p className="text-[var(--plan-muted)]">{formatAnchorDelta(point.protocol, point)}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </form>
  );
}

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function Sparkline({ points, label }: { points: number[]; label: string }) {
  const max = Math.max(...points, 1);
  return (
    <div className="flex h-8 items-end gap-1.5" role="img" aria-label={`${label}: ${points.join(", ")}`}>
      {points.map((point, index) => (
        <span
          key={`${label}-${index}`}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(4, Math.round((point / max) * 28))}px`,
            background: point > 0 ? BAR_COLORS[index] ?? BAR_COLORS[3] : "#efeae4"
          }}
        />
      ))}
    </div>
  );
}
