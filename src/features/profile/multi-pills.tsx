import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { QuestionnaireField } from "@/lib/profile-questionnaire";
import { inferMultiValues, toggleMultiValue } from "@/lib/questionnaire-multi";

interface MultiPillsProps {
  field: QuestionnaireField;
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function MultiPills({ field, name, value = "", onValueChange }: MultiPillsProps) {
  const options = field.options ?? [];
  const [selected, setSelected] = useState(() => inferMultiValues(value, options));

  useEffect(() => {
    const next = inferMultiValues(value, options);
    setSelected((current) => (sameValues(current, next) ? current : next));
  }, [value, options]);

  function toggle(optionValue: string) {
    const next = toggleMultiValue(selected, optionValue, options);
    setSelected(next);
    onValueChange?.(next.join(", "));
  }

  return (
    <div className="space-y-2">
      {selected.map((item) => (
        <input key={`${name}-hidden-${item}`} type="hidden" name={name} value={item} />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={`${name}-${option.value}`}
              type="button"
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-10 items-center justify-center rounded-full border px-3.5 py-1.5 text-center text-sm font-medium leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background/55 text-foreground hover:border-primary/60 hover:bg-primary/10"
              )}
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
