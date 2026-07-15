import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, ShieldAlert, X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { TrainingSession } from "@/lib/training";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { GuidedBlockView } from "./GuidedBlockView";
import { GuidedSessionExitDialog } from "./GuidedSessionExitDialog";
import { SessionCompletion } from "./SessionCompletion";
import { SessionStartSummary } from "./SessionStartSummary";
import { createGuidedRun, guidedSessionReducer } from "./guided-session-reducer";
import { loadGuidedSessionState, saveGuidedSessionState } from "./guided-session-storage";
import type { GuidedSessionDefinition, GuidedSessionEvent, GuidedSessionState } from "./guided-session-types";

type Props = {
  session: TrainingSession;
  definition?: GuidedSessionDefinition;
  definitions: Record<string, GuidedSessionDefinition>;
  storage?: Storage;
  onCloseToPlan: () => void;
  onOpenLog: (sessionId: string) => void;
  onSelectSession?: (sessionId: string) => void;
  onOpenInternal?: (target: "video" | "profile") => void;
  now?: () => string;
};

export function GuidedSessionFlow({ session, definition, definitions, storage = window.localStorage, onCloseToPlan, onOpenLog, onSelectSession, onOpenInternal, now = () => new Date().toISOString() }: Props) {
  const restoreFocusRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const initial = useRef<{ state: GuidedSessionState; warning: string | null } | null>(null);
  if (!initial.current) {
    const loaded = loadGuidedSessionState(storage, definitions, now());
    let initialState = loaded.state;
    if (definition && definition.blocks.length && (!initialState.activeRun || initialState.activeRun.status === "completed")) {
      initialState = guidedSessionReducer(initialState, { type: "CREATE_RUN", sessionId: session.id, definition, now: now() });
    }
    initial.current = { state: initialState, warning: loaded.warning };
  }

  const [state, setState] = useState(initial.current.state);
  const stateRef = useRef(state);
  const [storageWarning, setStorageWarning] = useState<string | null>(initial.current.warning);
  const [exitOpen, setExitOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const saved = saveGuidedSessionState(storage, stateRef.current);
    if (!saved.ok) setStorageWarning("No se puede guardar el progreso. La sesión sigue disponible mientras esta página permanezca abierta.");
  }, [storage]);

  const transition = useCallback((event: GuidedSessionEvent) => {
    const next = guidedSessionReducer(stateRef.current, event);
    stateRef.current = next;
    setState(next);
    const result = saveGuidedSessionState(storage, next);
    if (!result.ok) setStorageWarning("No se puede guardar el progreso. La sesión sigue disponible mientras esta página permanezca abierta.");
    return next;
  }, [storage]);

  useEffect(() => {
    const run = stateRef.current.activeRun;
    if (!definition || !definition.blocks.length) return;
    if (!run) {
      transition({ type: "CREATE_RUN", sessionId: session.id, definition, now: now() });
    } else if (run.sessionId !== session.id) {
      if (run.status === "completed") transition({ type: "CREATE_RUN", sessionId: session.id, definition, now: now() });
      else setConflictOpen(true);
    } else if (run.status === "paused") {
      transition({ type: "RESUME", definition, now: now() });
    }
  }, [definition, now, session.id, transition]);

  const run = state.activeRun;
  const block = definition && run?.sessionId === session.id ? definition.blocks[run.currentBlockIndex] : undefined;

  useEffect(() => {
    if (run?.status !== "active" || !block) return;
    scrollRef.current?.scrollTo?.({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    headingRef.current?.focus();
  }, [block, run?.currentBlockIndex, run?.status]);

  const modal = (content: React.ReactNode) => (
    <Dialog.Root open modal onOpenChange={(open) => { if (!open) setExitOpen(true); }}>
      <Dialog.Portal>
        <Dialog.Content
          aria-modal="true"
          className="fixed inset-0 z-50 flex min-w-0 flex-col overflow-hidden bg-background text-foreground outline-none"
          data-testid="guided-session-flow"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocusRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Sesión guiada</Dialog.Title>
          <Dialog.Description className="sr-only">Guía paso a paso para completar la sesión seleccionada.</Dialog.Description>
          {content}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  if (!definition || !definition.blocks.length) {
    return modal(
      <div className="grid min-h-full place-items-center gap-4 p-4">
        <Alert className="max-w-md"><ShieldAlert aria-hidden="true" /><AlertTitle>Esta sesión todavía no tiene guía</AlertTitle><AlertDescription>Volvé al plan para consultar el detalle existente.</AlertDescription></Alert>
        <Button className="h-11" onClick={onCloseToPlan}>Volver al plan</Button>
      </div>
    );
  }

  const handleStartSelected = () => {
    transition({ type: "DISCARD", now: now() });
    transition({ type: "CREATE_RUN", sessionId: session.id, definition, now: now() });
    setConflictOpen(false);
  };

  return modal(
    <>
      {run?.status === "active" && run.sessionId === session.id && (
        <header className="z-10 flex shrink-0 items-center gap-3 border-b bg-background/95 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-6">
          <Button type="button" variant="ghost" size="icon-lg" className="size-11" aria-label="Pausar o salir" onClick={() => setExitOpen(true)}><X aria-hidden="true" /></Button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{session.title.replace("Escalada ", "")}</p><p className="text-xs text-muted-foreground">Bloque {run.currentBlockIndex + 1} de {definition.blocks.length}</p></div>
          <Pause aria-hidden="true" className="size-4 text-muted-foreground" />
        </header>
      )}

      {storageWarning && <Alert className="mx-auto mt-2 max-w-3xl shrink-0" variant="destructive"><AlertTitle>Guardado no disponible</AlertTitle><AlertDescription>{storageWarning}</AlertDescription></Alert>}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {run?.sessionId === session.id && run.status === "summary" && <SessionStartSummary session={session} definition={definition} onStart={() => transition({ type: "START", definition, now: now() })} onBack={onCloseToPlan} />}
        {run?.sessionId === session.id && run.status === "active" && block && (
          <>
            <p className="sr-only" aria-live="polite">Bloque {run.currentBlockIndex + 1} de {definition.blocks.length}: {block.title}</p>
            <GuidedBlockView
              block={block}
              index={run.currentBlockIndex}
              total={definition.blocks.length}
              isCompleted={run.completedBlockIds.includes(block.id)}
              onPrevious={() => transition({ type: "GO_TO_BLOCK", index: run.currentBlockIndex - 1, definition, now: now() })}
              onNext={() => transition({ type: "GO_TO_BLOCK", index: run.currentBlockIndex + 1, definition, now: now() })}
              onComplete={() => transition({ type: "COMPLETE_BLOCK", blockId: block.id, definition, now: now() })}
              onSkip={() => transition({ type: "SKIP_BLOCK", blockId: block.id, definition, now: now() })}
              onOpenInternal={(target) => {
                transition({ type: "PAUSE", now: now() });
                if (target === "video" || target === "profile") onOpenInternal?.(target);
              }}
              headingRef={headingRef}
            />
          </>
        )}
        {run?.sessionId === session.id && run.status === "completed" && <SessionCompletion session={session} definition={definition} run={run} onOpenLog={onOpenLog} onBack={onCloseToPlan} onRestart={() => transition({ type: "RESTART", sessionId: session.id, definition, now: now() })} />}
      </div>

      <GuidedSessionExitDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onPause={() => { transition({ type: "PAUSE", now: now() }); onCloseToPlan(); }}
        onDiscard={() => { transition({ type: "DISCARD", now: now() }); onCloseToPlan(); }}
      />

      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Sesión en curso</AlertDialogTitle><AlertDialogDescription>Hay otra sesión sin terminar. Elegí cuál querés continuar.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" onClick={onCloseToPlan}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11" variant="outline" onClick={() => run && onSelectSession?.(run.sessionId)}>Volver a la sesión activa</AlertDialogAction>
            <AlertDialogAction className="h-11" variant="destructive" onClick={handleStartSelected}>Descartar y empezar esta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
