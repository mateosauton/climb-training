import { CheckCircle2, RotateCcw } from "lucide-react";
import type { TrainingSession } from "@/lib/training";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { GuidedRun, GuidedSessionDefinition } from "./guided-session-types";

type Props = { session: TrainingSession; definition: GuidedSessionDefinition; run: GuidedRun; onOpenLog: (sessionId: string) => void; onBack: () => void; onRestart: () => void };

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function SessionCompletion({ session, definition, run, onOpenLog, onBack, onRestart }: Props) {
  const skipped = definition.blocks.filter(({ id }) => run.skippedBlockIds.includes(id));
  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl items-center px-4 py-8 sm:px-6">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
          <Badge>Sesión completada</Badge>
          <h1 className="font-heading text-2xl font-semibold">{session.title.replace("Escalada ", "")}</h1>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Tiempo activo</dt><dd className="mt-1 font-semibold">{durationLabel(run.accumulatedActiveSeconds)}</dd></div>
            <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Completados</dt><dd className="mt-1 font-semibold">{run.completedBlockIds.length} {run.completedBlockIds.length === 1 ? "completado" : "completados"}</dd></div>
            <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Saltados</dt><dd className="mt-1 font-semibold">{run.skippedBlockIds.length}</dd></div>
          </dl>
          {skipped.length > 0 && <section><h2 className="mb-2 font-semibold">Bloques saltados</h2><ul className="list-disc pl-5 text-muted-foreground">{skipped.map(({ id, title }) => <li key={id}>{title}</li>)}</ul></section>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" size="lg" className="h-11 sm:col-span-2" onClick={() => onOpenLog(run.sessionId)}>Registrar resultados</Button>
            <Button type="button" variant="outline" size="lg" className="h-11" onClick={onBack}>Volver al plan</Button>
            <Button type="button" variant="ghost" size="lg" className="h-11" onClick={onRestart}><RotateCcw aria-hidden="true" /> Repetir sesión</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
