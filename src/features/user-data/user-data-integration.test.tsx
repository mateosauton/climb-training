import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { defaultState } from "../../lib/training";
import { USER_DATA_STORAGE_KEY } from "./user-data-storage";

describe("user data App integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("migrates the legacy tracker into one persisted active user", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({
      ...defaultState,
      profile: {
        ...defaultState.profile,
        questionnaireCompleted: true,
        questionnaireCompletedAt: "2026-07-10T10:00:00.000Z",
        questionnaireVersion: 1
      }
    }));

    render(<App />);

    await waitFor(() => expect(localStorage.getItem(USER_DATA_STORAGE_KEY)).not.toBeNull());
    const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "null");
    expect(envelope.schemaVersion).toBe(3);
    expect(Object.keys(envelope.users)).toEqual([envelope.activeUserId]);
    expect(envelope.users[envelope.activeUserId].facts.some((fact: { key: string; value: unknown }) => fact.key === "name" && fact.value === "Mateo")).toBe(true);
  });

  it("appends a sourced profile fact and preserves its predecessor", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({
      ...defaultState,
      profile: { ...defaultState.profile, questionnaireCompleted: true }
    }));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Abrir perfil de Mateo" }));
    const age = await screen.findByLabelText("Edad");
    fireEvent.change(age, { target: { value: "28" } });
    await user.click(await screen.findByRole("tab", { name: "Escalada" }));
    const grade = await screen.findByLabelText("Grado actual");
    fireEvent.change(grade, { target: { value: "7c" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "null");
      const facts = envelope.users[envelope.activeUserId].facts.filter((fact: { key: string }) => fact.key === "currentGrade");
      const ageFacts = envelope.users[envelope.activeUserId].facts.filter((fact: { key: string }) => fact.key === "age");
      expect(facts.at(-1)).toMatchObject({ value: "7c", source: { type: "profile-form" } });
      expect(facts.at(-1).supersedes).toBe(facts.at(-2).id);
      expect(ageFacts.at(-1)).toMatchObject({ value: "28", source: { type: "profile-form" } });
    });
    expect(await screen.findByText("28 años · Argentina")).toBeInTheDocument();
  });

  it("does not report success when local profile recovery cannot be persisted", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({
      ...defaultState,
      profile: { ...defaultState.profile, questionnaireCompleted: true }
    }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Abrir perfil de Mateo" }));
    fireEvent.change(await screen.findByLabelText("Edad"), { target: { value: "28" } });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("No pudimos guardar los cambios.")).toBeInTheDocument();
    expect(screen.queryByText("28 años · Argentina")).not.toBeInTheDocument();
  });

  it("keeps corrupt v3 JSON unchanged and shows a persistent warning", async () => {
    const corrupt = "{not-valid-json";
    localStorage.setItem(USER_DATA_STORAGE_KEY, corrupt);
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("datos locales v3 estan danados");
    expect(localStorage.getItem(USER_DATA_STORAGE_KEY)).toBe(corrupt);
  });

  it("shows athlete identity and opens Profile only from the avatar button", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({
      ...defaultState,
      profile: { ...defaultState.profile, name: "Mateo Sauton", questionnaireCompleted: true }
    }));
    render(<App />);

    expect(await screen.findByText("Mateo Sauton")).toBeInTheDocument();
    expect(screen.getByText(`${defaultState.goals.currentGrade} → ${defaultState.goals.targetGrade}`)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Perfil" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir perfil de Mateo Sauton" }));
    expect(await screen.findByText("Perfil del escalador")).toBeInTheDocument();
  });
});
