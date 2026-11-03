import { QUESTIONNAIRE_SECTIONS, type QuestionnaireOption } from "./profile-questionnaire";

export function splitMultiValue(value: unknown): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function inferMultiValues(value: unknown, options: QuestionnaireOption[] = []): string[] {
  const tokens = new Set(splitMultiValue(value));
  const selected: string[] = [];
  for (const option of options) {
    if (!option.value) continue;
    const matchesValue = tokens.has(option.value);
    const matchesLabel = Boolean(option.label) && tokens.has(option.label);
    if ((matchesValue || matchesLabel) && !selected.includes(option.value)) selected.push(option.value);
  }
  return selected;
}

export function toggleMultiValue(selected: readonly string[], optionValue: string, options: QuestionnaireOption[] = []): string[] {
  const option = options.find((item) => item.value === optionValue);
  if (!option) return selected.filter((item) => item !== optionValue);
  if (selected.includes(optionValue)) return selected.filter((item) => item !== optionValue);
  if (option.exclusive) return [optionValue];

  const blocked = new Set(options.filter((item) => item.exclusive).map((item) => item.value));
  if (option.exclusiveGroup) {
    for (const item of options) {
      if (item.exclusiveGroup === option.exclusiveGroup) blocked.add(item.value);
    }
  }
  return [...selected.filter((item) => !blocked.has(item)), optionValue];
}

export function appendMultiFieldValues(form: FormData, name: string, value: unknown, options: QuestionnaireOption[] = []) {
  for (const item of inferMultiValues(value, options)) form.append(name, item);
}

export function normalizeQuestionnaireDraft<T extends Record<string, unknown>>(profile: T): T {
  const draft: Record<string, unknown> = { ...profile };
  for (const section of QUESTIONNAIRE_SECTIONS) {
    for (const field of section.fields) {
      if (field.kind !== "multi") continue;
      draft[field.name] = inferMultiValues(draft[field.name], field.options).join(", ");
    }
  }
  return draft as T;
}
