import { describe, expect, it, vi } from "vitest";

import { avatarPath, createAvatarSignedUrl, uploadAvatar, validateAvatarFile, type CloudAvatarError } from "./cloud-avatar";

function fakeClient() {
  const upload = vi.fn().mockResolvedValue({ data: null, error: null });
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/avatar" }, error: null });
  return {
    client: {
      storage: { from: vi.fn().mockReturnValue({ upload, createSignedUrl }) }
    },
    upload,
    createSignedUrl
  };
}

describe("profile photo files", () => {
  it.each([
    ["photo.jpg", "image/jpeg", "jpg"],
    ["photo.png", "image/png", "png"],
    ["photo.webp", "image/webp", "webp"]
  ])("accepts %s and creates its deterministic path", (name, type, extension) => {
    const file = new File(["photo"], name, { type });

    expect(validateAvatarFile(file)).toBe(extension);
    expect(avatarPath("athlete-1", file)).toBe(`athlete-1/avatar.${extension}`);
  });

  it("rejects unsupported MIME types", () => {
    expect(() => validateAvatarFile(new File(["photo"], "photo.gif", { type: "image/gif" })))
      .toThrowError(expect.objectContaining<CloudAvatarError>({ code: "invalid_avatar_file" }));
  });

  it("rejects files larger than 5 MiB", () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "photo.jpg", { type: "image/jpeg" });

    expect(() => validateAvatarFile(file))
      .toThrowError(expect.objectContaining<CloudAvatarError>({ code: "avatar_too_large" }));
  });
});

describe("cloud avatar storage", () => {
  it("uploads to the private profile bucket with overwrite enabled", async () => {
    const fake = fakeClient();
    const file = new File(["photo"], "photo.png", { type: "image/png" });

    await expect(uploadAvatar(fake.client, "athlete-1", file)).resolves.toBe("athlete-1/avatar.png");
    expect(fake.client.storage.from).toHaveBeenCalledWith("profile-photos");
    expect(fake.upload).toHaveBeenCalledWith("athlete-1/avatar.png", file, {
      contentType: "image/png",
      upsert: true
    });
  });

  it("loads a signed URL for a persisted private path", async () => {
    const fake = fakeClient();

    await expect(createAvatarSignedUrl(fake.client, "athlete-1/avatar.webp")).resolves.toBe("https://signed.example/avatar");
    expect(fake.createSignedUrl).toHaveBeenCalledWith("athlete-1/avatar.webp", 60);
  });

  it("returns the same discriminated error shape for storage failures", async () => {
    const fake = fakeClient();
    fake.upload.mockResolvedValueOnce({ data: null, error: { message: "provider detail" } });

    await expect(uploadAvatar(fake.client, "athlete-1", new File(["photo"], "photo.jpg", { type: "image/jpeg" })))
      .rejects.toEqual({ code: "unavailable" } satisfies CloudAvatarError);
  });
});
