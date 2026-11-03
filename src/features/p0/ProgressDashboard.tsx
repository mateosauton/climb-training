import { useState } from "react";
import { ChevronRight } from "lucide-react";

import type { SessionLog } from "../../lib/training";
import { buildProgress } from "./progress-kpis";

const BAR_COLORS = ["#e6e1db", "#d4cdc4", "#6b7d72", "#354a40"] as const;

interface ProgressDashboardProps {
  logs: readonly Pick<SessionLog, "createdAt" | "bestLink" | "footCuts" | "rpe" | "pain">[];
  today: string;
  athleteInitials: string;
  onOpenProfile: () => void;
}

export function ProgressDashboard({ logs, today, athleteInitials, onOpenProfile }: ProgressDashboardProps) {
  const model = buildProgress(logs, today);
  const [detailOpen, setDetailOpen] = useState(false);

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
