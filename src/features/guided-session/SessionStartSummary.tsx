import { CalendarDays, Clock3, ShieldAlert, Wrench } from "lucide-react";
import type { TrainingSession } from "@/lib/training";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { GuidedSessionDefinition } from "./guided-session-types";

type Props = {
  session: TrainingSession;
  definition: GuidedSessionDefinition;
  onStart: () => void;
  onBack: () => void;
};

export function SessionStartSummary({ session, definition, onStart, onBack }: Props) {
  const equipment = [...new Set(definition.blocks.flatMap((block) => block.equipment))];
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{session.phase}</Badge>
            <Badge variant="outline">Intensidad {session.intensity}</Badge>
          </div>
          <h1 className="font-heading text-2xl font-semibold leading-tight">{session.title.replace("Escalada ", "")}</h1>
          <p className="text-base text-muted-foreground">{definition.objective}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 size-4" aria-hidden="true" /><div><dt className="text-muted-foreground">Fecha</dt><dd className="font-medium">{session.date} · {session.start}</dd></div></div>
            <div className="flex items-start gap-2"><Clock3 className="mt-0.5 size-4" aria-hidden="true" /><div><dt className="text-muted-foreground">Duración estimada</dt><dd className="font-medium">{session.start}–{session.end}</dd></div></div>
          </dl>

          <section aria-labelledby="summary-blocks">
            <h2 id="summary-blocks" className="mb-2 font-semibold">Bloques de la sesión</h2>
            <ol className="space-y-2">
              {definition.blocks.map((block, index) => (
                <li className="flex items-start gap-3 rounded-lg border p-3" key={block.id}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>
                  <div><p className="font-medium">{block.title}</p><p className="text-sm text-muted-foreground">{block.estimatedMinutes ? `${block.estimatedMinutes} min · ` : ""}{block.dose}</p></div>
                </li>
              ))}
            </ol>
          </section>

          {equipment.length > 0 && <section aria-labelledby="summary-equipment"><h2 id="summary-equipment" className="mb-2 flex items-center gap-2 font-semibold"><Wrench className="size-4" aria-hidden="true" /> Equipo</h2><p className="text-sm text-muted-foreground">{equipment.join(" · ")}</p></section>}

          <Alert><ShieldAlert aria-hidden="true" /><AlertTitle>Seguridad primero</AlertTitle><AlertDescription>{definition.safetyNote}</AlertDescription></Alert>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" className="h-11" onClick={onBack}>Volver al plan</Button>
            <Button type="button" size="lg" className="h-11" onClick={onStart}>Empezar sesión</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
