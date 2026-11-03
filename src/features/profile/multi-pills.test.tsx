import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { QUESTIONNAIRE_SECTIONS, type QuestionnaireField } from "@/lib/profile-questionnaire";
import { defaultState } from "@/lib/training";
import { MultiPills } from "./multi-pills";

function fieldByName(name: string): QuestionnaireField {
  const field = QUESTIONNAIRE_SECTIONS.flatMap((section) => section.fields).find((item) => item.name === name);
  if (!field) throw new Error(`Missing field ${name}`);
  return field;
}

function ControlledPills({ field, initial = "" }: { field: QuestionnaireField; initial?: string }) {
  const [value, setValue] = useState(initial);
  return <MultiPills field={field} name={field.name} value={value} onValueChange={setValue} />;
}

function hiddenValues(name: string) {
  return Array.from(document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)).map((input) => input.value);
}

describe("MultiPills", () => {
  it("selects and deselects every option without leaving a hidden input", async () => {
    const user = userEvent.setup();
    const fields = QUESTIONNAIRE_SECTIONS.flatMap((section) => section.fields).filter((field) => field.kind === "multi");

    for (const field of fields) {
      const { unmount } = render(<ControlledPills field={field} />);
      for (const option of field.options ?? []) {
        const button = screen.getByRole("button", { name: option.label });
        await user.click(button);
        expect(button).toHaveAttribute("aria-pressed", "true");
        expect(hiddenValues(field.name)).toEqual([option.value]);
        await user.click(button);
        expect(button).toHaveAttribute("aria-pressed", "false");
        expect(hiddenValues(field.name)).toEqual([]);
      }
      unmount();
    }
  });

  it("keeps Hangboard and one board bucket from selecting each other", async () => {
    const user = userEvent.setup();
    render(<ControlledPills field={fieldByName("trainingLoad")} />);

    await user.click(screen.getByRole("button", { name: "Hangboard" }));
    expect(screen.getByRole("button", { name: "Board 1-2/sem" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Board 3+/sem" })).toHaveAttribute("aria-pressed", "false");
    expect(hiddenValues("trainingLoad")).toEqual(["Hangboard"]);

    await user.click(screen.getByRole("button", { name: "Board 1-2/sem" }));
    await user.click(screen.getByRole("button", { name: "Board 3+/sem" }));
    expect(screen.getByRole("button", { name: "Board 1-2/sem" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Board 3+/sem" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hangboard" })).toHaveAttribute("aria-pressed", "true");
    expect(hiddenValues("trainingLoad")).toEqual(["Board 3+/sem", "Hangboard"]);

    await user.click(screen.getByRole("button", { name: "Fuerza 1/sem" }));
    await user.click(screen.getByRole("button", { name: "Fuerza 2+/sem" }));
    expect(screen.getByRole("button", { name: "Fuerza 1/sem" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Fuerza 2+/sem" })).toHaveAttribute("aria-pressed", "true");
  });

  it("clears other recovery and injury pills around the exclusive options", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ControlledPills field={fieldByName("recoveryNotes")} />);
    await user.click(screen.getByRole("button", { name: "Codo cargado" }));
    expect(screen.getByRole("button", { name: "Hombro cargado" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Sueno bajo" }));
    await user.click(screen.getByRole("button", { name: "Sin senales" }));
    expect(screen.getByRole("button", { name: "Sin senales" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sueno bajo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Codo cargado" })).toHaveAttribute("aria-pressed", "false");
    expect(hiddenValues("recoveryNotes")).toEqual(["Sin senales"]);
    await user.click(screen.getByRole("button", { name: "Sueno bajo" }));
    expect(screen.getByRole("button", { name: "Sin senales" })).toHaveAttribute("aria-pressed", "false");
    expect(hiddenValues("recoveryNotes")).toEqual(["Sueno bajo"]);
    unmount();

    render(<ControlledPills field={fieldByName("injuryHistory")} />);
    await user.click(screen.getByRole("button", { name: "Dedos / polea" }));
    await user.click(screen.getByRole("button", { name: "Ninguna" }));
    expect(screen.getByRole("button", { name: "Dedos / polea" })).toHaveAttribute("aria-pressed", "false");
    expect(hiddenValues("injuryHistory")).toEqual(["Ninguna relevante"]);
    await user.click(screen.getByRole("button", { name: "Codo" }));
    expect(screen.getByRole("button", { name: "Ninguna" })).toHaveAttribute("aria-pressed", "false");
    expect(hiddenValues("injuryHistory")).toEqual(["Codo"]);
  });

  it("does not render orphan hidden inputs for legacy freeform text", () => {
    const { rerender } = render(
      <MultiPills
        field={fieldByName("injuryHistory")}
        name="injuryHistory"
        value={defaultState.profile.injuryHistory}
      />
    );
    expect(hiddenValues("injuryHistory")).toEqual([]);
    expect(screen.getByRole("button", { name: "Codo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Hombro" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Dedos / polea" })).toHaveAttribute("aria-pressed", "false");

    rerender(
      <MultiPills
        field={fieldByName("recoveryNotes")}
        name="recoveryNotes"
        value={defaultState.profile.recoveryNotes}
      />
    );
    expect(hiddenValues("recoveryNotes")).toEqual([]);
    expect(screen.getByRole("button", { name: "Sueno bajo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Energia baja" })).toHaveAttribute("aria-pressed", "false");
  });
});
