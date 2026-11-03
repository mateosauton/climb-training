import { describe, expect, it } from "vitest";

import { QUESTIONNAIRE_SECTIONS, type QuestionnaireField } from "./profile-questionnaire";
import { defaultState } from "./training";
import {
  appendMultiFieldValues,
  inferMultiValues,
  normalizeQuestionnaireDraft,
  toggleMultiValue
} from "./questionnaire-multi";

function fieldByName(name: string): QuestionnaireField {
  const field = QUESTIONNAIRE_SECTIONS.flatMap((section) => section.fields).find((item) => item.name === name);
  if (!field?.options) throw new Error(`Missing multi field ${name}`);
  return field;
}

const trainingLoad = fieldByName("trainingLoad");
const recoveryNotes = fieldByName("recoveryNotes");
const injuryHistory = fieldByName("injuryHistory");

describe("inferMultiValues", () => {
  it("keeps exact option tokens and drops legacy freeform orphans", () => {
    expect(inferMultiValues(defaultState.profile.injuryHistory, injuryHistory.options)).toEqual([]);
    expect(inferMultiValues(defaultState.profile.recoveryNotes, recoveryNotes.options)).toEqual([]);
    expect(inferMultiValues("Hangboard", trainingLoad.options)).toEqual(["Hangboard"]);
    expect(inferMultiValues("Board 1-2/sem", trainingLoad.options)).toEqual(["Board 1-2/sem"]);
    expect(inferMultiValues("Codo cargado", recoveryNotes.options)).toEqual(["Codo cargado"]);
    expect(inferMultiValues("Hangboard, notas sueltas, Board 1-2/sem", trainingLoad.options)).toEqual([
      "Board 1-2/sem",
      "Hangboard"
    ]);
    expect(inferMultiValues("Dedos / polea", injuryHistory.options)).toEqual(["Polea / A2 / dedos"]);
  });

  it("does not treat shared words as selections", () => {
    expect(inferMultiValues("quiero un hangboard y un board en casa", trainingLoad.options)).toEqual([]);
    expect(inferMultiValues("Codo cargado", recoveryNotes.options)).not.toContain("Hombro cargado");
  });
});

describe("toggleMultiValue", () => {
  it("selects and deselects every multi option back to empty", () => {
    const fields = QUESTIONNAIRE_SECTIONS.flatMap((section) => section.fields).filter((field) => field.kind === "multi");
    for (const field of fields) {
      for (const option of field.options ?? []) {
        const selected = toggleMultiValue([], option.value, field.options);
        expect(selected).toEqual([option.value]);
        expect(toggleMultiValue(selected, option.value, field.options)).toEqual([]);
      }
    }
  });

  it("makes Sin senales and Ninguna relevante exclusive", () => {
    expect(recoveryNotes.options?.find((option) => option.value === "Sin senales")?.exclusive).toBe(true);
    expect(injuryHistory.options?.find((option) => option.value === "Ninguna relevante")?.exclusive).toBe(true);
    expect(toggleMultiValue(["Sueno bajo", "Energia baja"], "Sin senales", recoveryNotes.options)).toEqual(["Sin senales"]);
    expect(toggleMultiValue(["Sin senales"], "Sueno bajo", recoveryNotes.options)).toEqual(["Sueno bajo"]);
    expect(toggleMultiValue(["Codo", "Hombro"], "Ninguna relevante", injuryHistory.options)).toEqual(["Ninguna relevante"]);
    expect(toggleMultiValue(["Ninguna relevante"], "Codo", injuryHistory.options)).toEqual(["Codo"]);
  });

  it("keeps board and strength frequency buckets mutually exclusive", () => {
    const boardGroup = trainingLoad.options?.find((option) => option.value === "Board 1-2/sem")?.exclusiveGroup;
    expect(boardGroup).toBeTruthy();
    expect(trainingLoad.options?.find((option) => option.value === "Board 3+/sem")?.exclusiveGroup).toBe(boardGroup);
    expect(trainingLoad.options?.find((option) => option.value === "Hangboard")?.exclusiveGroup).toBeUndefined();

    const strengthGroup = trainingLoad.options?.find((option) => option.value === "Fuerza 1/sem")?.exclusiveGroup;
    expect(strengthGroup).toBeTruthy();
    expect(strengthGroup).not.toBe(boardGroup);
    expect(trainingLoad.options?.find((option) => option.value === "Fuerza 2+/sem")?.exclusiveGroup).toBe(strengthGroup);

    expect(toggleMultiValue(["Board 1-2/sem", "Hangboard"], "Board 3+/sem", trainingLoad.options)).toEqual([
      "Hangboard",
      "Board 3+/sem"
    ]);
    expect(toggleMultiValue(["Fuerza 1/sem", "Hangboard"], "Fuerza 2+/sem", trainingLoad.options)).toEqual([
      "Hangboard",
      "Fuerza 2+/sem"
    ]);
  });
});

describe("questionnaire multi form values", () => {
  it("posts only known option values", () => {
    const form = new FormData();
    appendMultiFieldValues(form, "injuryHistory", defaultState.profile.injuryHistory, injuryHistory.options);
    appendMultiFieldValues(form, "trainingLoad", "Hangboard, basura", trainingLoad.options);
    expect(form.getAll("injuryHistory")).toEqual([]);
    expect(form.getAll("trainingLoad")).toEqual(["Hangboard"]);
  });

  it("normalizes legacy freeform out of a questionnaire draft without clearing the demo name", () => {
    const draft = normalizeQuestionnaireDraft({
      ...defaultState.profile,
      trainingLoad: "Hangboard, notas sueltas, Board 3+/sem"
    });
    expect(draft.name).toBe("Mateo");
    expect(draft.injuryHistory).toBe("");
    expect(draft.recoveryNotes).toBe("");
    expect(draft.trainingLoad).toBe("Board 3+/sem, Hangboard");
  });
});
