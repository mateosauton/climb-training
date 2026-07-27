import { Clock3 } from "lucide-react";
import { HoldMark } from "./ClimbMarks";
import { cn } from "@/lib/utils";

export function SessionCard({ className }: { className?: string }) {
  return <article className={cn("climb-session-card rounded-2xl border bg-card p-4", className)}><div className="flex gap-4"><div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-sandstone text-river"><HoldMark className="size-12" /></div><div className="min-w-0 flex-1"><p className="font-semibold">W1D1 · Limit + fuerza</p><div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />75 min</span><span className="rounded-full bg-clay px-2 py-0.5 text-xs font-semibold text-white">Intensa</span></div><div className="mt-4 flex items-center justify-between border-t border-dashed pt-3"><span className="flex gap-2" aria-label="Dos de seis bloques completados">{Array.from({ length: 6 }, (_, index) => <span key={index} className={cn("size-3 rounded-full border border-clay", index < 2 && "bg-clay")} />)}</span><button type="button" className="font-semibold text-river underline-offset-4 hover:underline">Ver detalle →</button></div></div></div></article>;
}
