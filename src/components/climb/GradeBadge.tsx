import { cn } from "@/lib/utils";

export const climbingGrades = ["green", "blue", "yellow", "orange", "red", "purple", "black"] as const;
export type ClimbingGrade = (typeof climbingGrades)[number];

const labels: Record<ClimbingGrade, string> = { green: "Verde", blue: "Azul", yellow: "Amarillo", orange: "Naranja", red: "Rojo", purple: "Violeta", black: "Negro" };

export function GradeBadge({ grade, className }: { grade: ClimbingGrade; className?: string }) {
  return <span className={cn("climb-grade inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", `climb-grade-${grade}`, className)}><span aria-hidden="true" className="size-2 rounded-full bg-current" />{labels[grade]}</span>;
}
