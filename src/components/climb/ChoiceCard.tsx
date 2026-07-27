import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = { label: string; description?: string; selected?: boolean; onClick?: () => void; mark?: ReactNode; className?: string };

export function ChoiceCard({ label, description, selected = false, onClick, mark, className }: Props) {
  const content = <><span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-sandstone text-river", selected && "bg-clay/15 text-clay")}>{mark}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span>{description ? <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span> : null}</span><span aria-hidden="true" className={cn("flex size-6 items-center justify-center rounded-full border border-border text-transparent", selected && "border-clay bg-clay text-white")}><Check className="size-3.5" /></span></>;
  return onClick ? <button type="button" aria-pressed={selected} onClick={onClick} className={cn("climb-choice-card flex min-h-20 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-river focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", selected && "border-clay", className)}>{content}</button> : <div className={cn("climb-choice-card flex min-h-20 items-center gap-3 rounded-xl border bg-card p-3", selected && "border-clay", className)}>{content}</div>;
}
