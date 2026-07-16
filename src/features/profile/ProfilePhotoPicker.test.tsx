import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePhotoPicker } from "./ProfilePhotoPicker";

function PickerHarness() {
  const [file, setFile] = React.useState<File | null>(null);
  return <ProfilePhotoPicker file={file} onFileChange={setFile} />;
}

describe("ProfilePhotoPicker", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:avatar-preview"),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("offers an accessible image input and circular preview", async () => {
    render(<PickerHarness />);
    const input = screen.getByLabelText("Foto de perfil");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");

    const file = new File(["photo"], "avatar.webp", { type: "image/webp" });
    await userEvent.upload(input, file);

    expect(screen.getByRole("img", { name: "Vista previa de la foto de perfil" })).toHaveClass("rounded-full");
  });

  it("replaces the preview and releases obsolete object URLs", () => {
    const { rerender, unmount } = render(<ProfilePhotoPicker file={new File(["one"], "one.png", { type: "image/png" })} onFileChange={() => undefined} />);
    rerender(<ProfilePhotoPicker file={new File(["two"], "two.png", { type: "image/png" })} onFileChange={() => undefined} />);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-preview");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("shows feedback and rejects unsupported or oversized files", () => {
    const onFileChange = vi.fn();
    render(<ProfilePhotoPicker file={null} onFileChange={onFileChange} />);
    const input = screen.getByLabelText("Foto de perfil");
    fireEvent.change(input, { target: { files: [new File(["gif"], "avatar.gif", { type: "image/gif" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG, PNG o WebP");
    expect(onFileChange).not.toHaveBeenCalled();
  });
});
