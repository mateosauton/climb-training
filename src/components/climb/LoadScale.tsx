import { cn } from "@/lib/utils";

type Props = { value: number; onChange?: (value: number) => void; label?: string; className?: string };

export function LoadScale({ value, onChange, label = "Carga de hoy", className }: Props) {
  return <fieldset className={cn("space-y-3", className)}><legend className="font-semibold">{label}</legend><div className="flex gap-1" role="radiogroup" aria-label={label}>{Array.from({ length: 10 }, (_, index) => index + 1).map((item) => <button key={item} type="button" role="radio" aria-checked={value === item} onClick={() => onChange?.(item)} className={cn("flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", value === item ? "border-lichen bg-lichen text-white" : "border-border bg-card hover:border-river")}>{item}</button>)}</div><div className="flex justify-between text-xs text-river"><span>Ligera</span><span className="text-clay">Alta</span></div></fieldset>;
}
