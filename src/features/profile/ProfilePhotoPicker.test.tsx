import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePhotoPicker } from "./ProfilePhotoPicker";
import type { AvatarFile } from "../cloud/cloud-avatar";

function PickerHarness() {
  const [file, setFile] = React.useState<AvatarFile | null>(null);
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

  it("opens the native picker from the visible button with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ProfilePhotoPicker file={null} onFileChange={() => undefined} />);
    const input = screen.getByLabelText("Foto de perfil");
    const click = vi.spyOn(input, "click");

    screen.getByRole("button", { name: "Elegir foto" }).focus();
    await user.keyboard("{Enter}");

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("allows selecting the same file twice", async () => {
    const onFileChange = vi.fn();
    const file = new File(["photo"], "avatar.png", { type: "image/png" });
    render(<ProfilePhotoPicker file={null} onFileChange={onFileChange} />);
    const input = screen.getByLabelText("Foto de perfil");

    await userEvent.upload(input, file);
    await userEvent.upload(input, file);

    expect(onFileChange).toHaveBeenCalledTimes(2);
  });

  it("replaces the preview and releases obsolete object URLs", async () => {
    vi.mocked(URL.createObjectURL).mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    const { unmount } = render(<PickerHarness />);
    const input = screen.getByLabelText("Foto de perfil");
    await userEvent.upload(input, new File(["one"], "one.png", { type: "image/png" }));
    await userEvent.upload(input, new File(["two"], "two.png", { type: "image/png" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first");
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
