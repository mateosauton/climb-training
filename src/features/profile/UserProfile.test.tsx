import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { defaultState } from "@/lib/training";
import { UserProfile } from "./UserProfile";

function renderProfile(overrides: Record<string, unknown> = {}) {
  const onSave = vi.fn();
  const view = render(
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
      onDownloadCsv={() => undefined}
      onReset={() => undefined}
      onSignOut={() => undefined}
      onOpenQuestionnaire={() => undefined}
      onToggleTheme={() => undefined}
      {...overrides}
    />
  );
  return { onSave, unmount: view.unmount };
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

  it("falls back to plan progress when grades are not comparable", () => {
    renderProfile({ goals: { ...defaultState.goals, currentGrade: "V6", targetGrade: "7a" }, planStatus: "ready", planProgress: 42 });
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Progreso del plan")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progreso: 42%" })).toBeInTheDocument();
  });

  it("shows Sin plan activo and no plan bar when there is no plan", () => {
    renderProfile({ goals: { ...defaultState.goals, currentGrade: "V6", targetGrade: "7a" }, planStatus: "empty", planProgress: null });
    expect(screen.queryByText("Plan activo")).not.toBeInTheDocument();
    expect(screen.getByText("Sin plan activo")).toBeInTheDocument();
    expect(screen.queryByText("Progreso del plan")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Completá grados comparables")).toBeInTheDocument();
  });

  it("shows Plan activo only when a plan is ready", () => {
    renderProfile({ planStatus: "ready" });
    expect(screen.getByText("Plan activo")).toBeInTheDocument();
    expect(screen.queryByText("Sin plan activo")).not.toBeInTheDocument();
  });

  it("shows the demonstration plan label", () => {
    renderProfile({ planStatus: "demo" });
    expect(screen.getByText("Plan de demostración")).toBeInTheDocument();
    expect(screen.queryByText("Plan activo")).not.toBeInTheDocument();
  });

  it("does not claim an active plan while it is loading or unreadable", () => {
    const view = renderProfile({ planStatus: "loading" });
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText("Plan activo")).not.toBeInTheDocument();
    view.unmount();
    renderProfile({ planStatus: "error" });
    expect(screen.queryByText("Plan activo")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin plan activo")).not.toBeInTheDocument();
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument();
  });

  it("moves focus to the editor from the header action", async () => {
    renderProfile();
    await userEvent.click(screen.getByRole("button", { name: "Editar perfil" }));
    expect(screen.getByLabelText("Editor de perfil")).toHaveFocus();
  });

  it("announces a recoverable cloud synchronization warning", async () => {
    renderProfile({ onSave: async () => ({ syncWarning: "Cambios guardados localmente. La sincronización quedó pendiente." }) });
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Cambios guardados localmente. La sincronización quedó pendiente.")).toBeInTheDocument();
  });

  it("explains read-only Salud and disconnects it from the account tab", async () => {
    const onDisconnectHealth = vi.fn();
    const user = userEvent.setup();
    renderProfile({ healthConnected: true, onDisconnectHealth, onConnectHealth: vi.fn() });
    await user.click(screen.getByRole("tab", { name: "Cuenta" }));
    expect(screen.getByText("Solo lectura. No es consejo médico: Maillon usa esto únicamente para ajustar descanso y carga. Puedes desconectar en Perfil.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conectar Salud" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desconectar Salud" }));
    expect(onDisconnectHealth).toHaveBeenCalledOnce();
  });

  it("offers Conectar Salud when the account is skipped or disconnected", async () => {
    const onConnectHealth = vi.fn();
    const user = userEvent.setup();
    renderProfile({ healthConnected: false, onConnectHealth, onDisconnectHealth: vi.fn() });
    await user.click(screen.getByRole("tab", { name: "Cuenta" }));
    expect(screen.getByText("No conectada. Puedes conectarla cuando quieras.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desconectar Salud" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Conectar Salud" }));
    expect(onConnectHealth).toHaveBeenCalledOnce();
  });

  it("supports keyboard navigation between editing tabs", async () => {
    const user = userEvent.setup();
    renderProfile();
    const general = screen.getByRole("tab", { name: "General" });
    general.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Escalada" })).toHaveAttribute("aria-selected", "true");
  });
});
