import { CairnMark } from "./ClimbMarks";
import { cn } from "@/lib/utils";

const readings = [{ label: "Sueño", value: 7, color: "bg-river" }, { label: "Energía", value: 6, color: "bg-lichen" }, { label: "Dolor", value: 3, color: "bg-clay" }];
export function RecoverySignal({ className }: { className?: string }) {
  return <section className={cn("climb-recovery rounded-2xl border bg-card p-4", className)} aria-label="Pulso de recuperación"><div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-full bg-sandstone text-lichen"><CairnMark className="size-9" /></div><div><h2 className="font-semibold">Recuperación</h2><p className="text-sm text-muted-foreground">Hoy: mantené la intensidad.</p></div></div><div className="mt-4 grid grid-cols-3 divide-x border-t pt-4">{readings.map(({ label, value, color }) => <div className="px-3 first:pl-0 last:pr-0" key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p><div className="mt-2 flex gap-1" aria-label={`${label} ${value} de 10`}>{Array.from({ length: 10 }, (_, index) => <span key={index} className={cn("h-4 w-1 rounded-full bg-sandstone", index < value && color)} />)}</div></div>)}</div></section>;
}
