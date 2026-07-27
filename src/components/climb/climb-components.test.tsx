import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoiceCard } from "./ChoiceCard";
import { GradeBadge, climbingGrades } from "./GradeBadge";
import { LoadScale } from "./LoadScale";

describe("Climb design-system components", () => {
  it("exposes grade labels in the required progression order", () => {
    expect(climbingGrades).toEqual(["green", "blue", "yellow", "orange", "red", "purple", "black"]);
    render(<GradeBadge grade="purple" />);
    expect(screen.getByText("Violeta")).toBeVisible();
  });

  it("announces and changes a route choice", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ChoiceCard label="Boulder" selected onClick={onClick} />);
    const choice = screen.getByRole("button", { name: "Boulder" });
    expect(choice).toHaveAttribute("aria-pressed", "true");
    await user.click(choice);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses an accessible radio group for the load scale", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LoadScale value={7} onChange={onChange} />);
    const selected = screen.getByRole("radio", { name: "7" });
    expect(selected).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "4" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
