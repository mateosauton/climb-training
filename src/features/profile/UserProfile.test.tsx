import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { defaultState } from "@/lib/training";
import { UserProfile } from "./UserProfile";

function renderProfile(overrides: Record<string, unknown> = {}) {
  const onSave = vi.fn();
  render(
    <UserProfile
      profile={{ ...defaultState.profile, name: "Mateo Sautón", age: "28", location: "Salta", strengths: "Regletas", limiters: "Lectura de pies" }}
      goals={{ ...defaultState.goals, currentGrade: "V6", targetGrade: "V8" }}
      logs={[]}
      now={new Date("2026-07-17T15:00:00Z")}
      avatarFile={null}
      avatarUrl={null}
      onAvatarFileChange={() => undefined}
      onSave={onSave}
      email="mateo@example.com"
      exportJson="{}"
      onCopyJson={() => undefined}
      onDownloadJson={() => undefined}
      onReset={() => undefined}
      onSignOut={() => undefined}
      onOpenQuestionnaire={() => undefined}
      onToggleTheme={() => undefined}
      {...overrides}
    />
  );
  return { onSave };
}

describe("UserProfile", () => {
  it("renders identity, age, grades and all summary metrics", () => {
    renderProfile();
    expect(screen.getByRole("heading", { name: "Mateo Sautón" })).toBeInTheDocument();
    expect(screen.getByText("28 años · Salta")).toBeInTheDocument();
    expect(screen.getByText("V6 actual")).toBeInTheDocument();
    expect(screen.getByText("V8 objetivo")).toBeInTheDocument();
    expect(screen.getByText("Racha")).toBeInTheDocument();
    expect(screen.getByText("Esta semana")).toBeInTheDocument();
    expect(screen.getByText("Carga")).toBeInTheDocument();
    expect(screen.getByText("Progreso")).toBeInTheDocument();
  });

  it("omits empty age and location instead of showing a placeholder", () => {
    renderProfile({ profile: { ...defaultState.profile, name: "Mateo", age: "", location: "" } });
    expect(screen.queryByText(/años/)).not.toBeInTheDocument();
    expect(screen.queryByText("Sin cargar")).not.toBeInTheDocument();
  });

  it("keeps one draft while changing tabs and submits normalized values", async () => {
    const user = userEvent.setup();
    const { onSave } = renderProfile();
    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Mateo Nuevo");
    await user.click(screen.getByRole("tab", { name: "Escalada" }));
    await user.clear(screen.getByLabelText("Proyecto actual"));
    await user.type(screen.getByLabelText("Proyecto actual"), "Moonboard");
    await user.click(screen.getByRole("tab", { name: "General" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mateo Nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Mateo Nuevo", project: "Moonboard" }));
  });

  it("validates age and focuses the invalid field", async () => {
    const user = userEvent.setup();
    const { onSave } = renderProfile();
    const age = screen.getByLabelText("Edad");
    await user.clear(age);
    await user.type(age, "-4");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert")).toHaveTextContent("número entero positivo");
    expect(age).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
  });
});
