import type { RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GuidedBlock } from "./guided-session-types";
import { GuidedMedia } from "./GuidedMedia";

type Props = {
  block: GuidedBlock;
  index: number;
  total: number;
  isCompleted: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
  onSkip: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
};

const phaseLabels: Record<GuidedBlock["phase"], string> = { prepare: "Preparación", work: "Trabajo", rest: "Recuperación", cooldown: "Vuelta a la calma", review: "Revisión" };

export function GuidedBlockView({ block, index, total, isCompleted, onPrevious, onNext, onComplete, onSkip, headingRef }: Props) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-32 sm:px-6 sm:py-8 sm:pb-28">
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">Bloque {index + 1} de {total}</span><span className="text-muted-foreground">{Math.round(((index + 1) / total) * 100)}%</span></div>
        <Progress value={((index + 1) / total) * 100} aria-label="Progreso de la sesión" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} />
      </div>
      <Card>
        <CardHeader className="space-y-2">
          <Badge variant="outline">{phaseLabels[block.phase]}</Badge>
          <h1 ref={headingRef} tabIndex={-1} className="font-heading text-2xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">{block.title}</h1>
          <p className="text-base text-muted-foreground">{block.instruction}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {block.dose && <section><h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dosis</h2><p className="text-base font-medium">{block.dose}</p></section>}
          {block.rationale && <section><h2 className="mb-1 font-semibold">Por qué</h2><p className="text-muted-foreground">{block.rationale}</p></section>}
          <section><h2 className="mb-2 font-semibold">Pasos</h2><ol aria-label="Pasos" className="list-decimal space-y-2 pl-5">{block.steps.map((step) => <li key={step}>{step.replace(/^\d+\.\s*/, "")}</li>)}</ol></section>
          <section><h2 className="mb-2 font-semibold">Claves</h2><ul className="list-disc space-y-1 pl-5">{block.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul></section>
          {block.avoid && <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"><h2 className="mb-1 font-semibold text-destructive">Evitar</h2><p>{block.avoid}</p></section>}
          <GuidedMedia media={block.media} />
        </CardContent>
      </Card>

      <footer data-testid="guided-actions" className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-[auto_1fr_auto]">
          <Button type="button" variant="outline" size="lg" className="h-11" disabled={index === 0} onClick={onPrevious}>Anterior</Button>
          <Button type="button" variant="ghost" size="lg" className="h-11 sm:order-3" onClick={onSkip}>Saltar bloque</Button>
          <Button type="button" size="lg" className="col-span-2 h-11 w-full sm:col-span-1" onClick={isCompleted ? onNext : onComplete}>{isCompleted ? "Siguiente" : "Completar y seguir"}</Button>
        </div>
      </footer>
    </main>
  );
}
