import { Play, TimerReset } from "lucide-react";
import type { TrainingSession } from "@/lib/training";
import { Button } from "@/components/ui/button";
import type { GuidedRun, GuidedSessionDefinition } from "./guided-session-types";

type Props = {
  session: TrainingSession;
  definition: GuidedSessionDefinition;
  run: GuidedRun;
  onResume: () => void;
};

export function GuidedResumeBanner({ session, definition, run, onResume }: Props) {
  return (
    <aside aria-label="Sesión pausada" className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm sm:flex-row sm:items-center">
      <TimerReset aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Sesión pausada</p>
        <p className="truncate text-sm text-muted-foreground">{session.title.replace("Escalada ", "")} · Bloque {run.currentBlockIndex + 1} de {definition.blocks.length}</p>
      </div>
      <Button type="button" size="lg" className="h-11 w-full sm:w-auto" onClick={onResume}><Play aria-hidden="true" /> Continuar sesión</Button>
    </aside>
  );
}
