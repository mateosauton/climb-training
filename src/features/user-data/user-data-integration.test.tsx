import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { defaultState } from "../../lib/training";
import { USER_DATA_STORAGE_KEY } from "./user-data-storage";

describe("user data App integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

    await user.click(screen.getAllByRole("tab", { name: "Perfil" })[0]);
    const grade = await screen.findByLabelText("Grado actual");
    fireEvent.change(grade, { target: { value: "7c" } });
    await user.click(screen.getByRole("button", { name: "Guardar objetivos" }));

    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "null");
      const facts = envelope.users[envelope.activeUserId].facts.filter((fact: { key: string }) => fact.key === "currentGrade");
      expect(facts.at(-1)).toMatchObject({ value: "7c", source: { type: "profile-form" } });
      expect(facts.at(-1).supersedes).toBe(facts.at(-2).id);
    });
  });

  it("keeps corrupt v3 JSON unchanged and shows a persistent warning", async () => {
    const corrupt = "{not-valid-json";
    localStorage.setItem(USER_DATA_STORAGE_KEY, corrupt);
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("datos locales v3 estan danados");
    expect(localStorage.getItem(USER_DATA_STORAGE_KEY)).toBe(corrupt);
  });
});
