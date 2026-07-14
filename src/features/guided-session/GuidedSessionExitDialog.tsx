import { AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onPause: () => void; onDiscard: () => void };

export function GuidedSessionExitDialog({ open, onOpenChange, onPause, onDiscard }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><AlertTriangle aria-hidden="true" /></AlertDialogMedia>
          <AlertDialogTitle>Pausar sesión</AlertDialogTitle>
          <AlertDialogDescription>Tu progreso queda guardado para continuar desde el plan.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">Seguir entrenando</AlertDialogCancel>
          <AlertDialogAction className="h-11" onClick={onPause}>Pausar y salir</AlertDialogAction>
          <AlertDialogAction className="h-11" variant="destructive" onClick={onDiscard}>Descartar sesión</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
