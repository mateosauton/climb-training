import { describe, expect, it, vi } from "vitest";

import { createCloudVideoService, videoPath } from "./cloud-video";

describe("videoPath", () => {
  it("uses a deterministic private object name", () => {
    expect(videoPath("athlete-1", "video-1", "attempt.MP4")).toBe("athlete-1/video-1/original.mp4");
  });

  it.each([
    ["", "video-1", "attempt.mp4"],
    ["athlete-1", "", "attempt.mp4"],
    ["athlete-1", "video-1", "attempt.exe"]
  ])("rejects unsafe path input", (userId, videoId, fileName) => {
    expect(() => videoPath(userId, videoId, fileName)).toThrow("invalid_video_path");
  });
});

function fakeClient({ uploadError }: { uploadError?: unknown } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError ?? null });
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const insert = vi.fn().mockResolvedValue({ error: null });
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "athlete-1" } }, error: null }) },
      storage: { from: vi.fn().mockReturnValue({ upload, createSignedUrl: vi.fn() }) },
      from: vi.fn().mockReturnValue({ insert, update })
    },
    upload,
    insert,
    update
  };
}

describe("cloud video lifecycle", () => {
  it("keeps a retryable metadata record and reuses its private path after an upload failure", async () => {
    const failed = fakeClient({ uploadError: { message: "provider detail" } });
    const ids = vi.fn().mockReturnValueOnce("video-1").mockReturnValueOnce("video-2");
    const checksum = vi.fn().mockResolvedValue("a".repeat(64));
    const service = createCloudVideoService(failed.client, { createId: ids, checksum });
    const file = new File(["clip"], "attempt.mp4", { type: "video/mp4" });

    await expect(service.upload(file)).rejects.toEqual({ code: "upload_pending", videoId: "video-1", path: "athlete-1/video-1/original.mp4" });
    expect(failed.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: "video-1",
      athlete_id: "athlete-1",
      object_path: "athlete-1/video-1/original.mp4",
      upload_status: "pending",
      processing_status: "pending"
    }));
    expect(failed.update).toHaveBeenCalledWith({ sanitized_failure: { code: "upload_pending" } });

    const retry = fakeClient();
    const retryService = createCloudVideoService(retry.client, { createId: ids, checksum });
    const result = await retryService.upload(file, { videoId: "video-1" });

    expect(result).toEqual({ videoId: "video-1", path: "athlete-1/video-1/original.mp4" });
    expect(ids).toHaveBeenCalledTimes(1);
    expect(retry.upload).toHaveBeenCalledWith("athlete-1/video-1/original.mp4", file, expect.objectContaining({ upsert: true }));
  });

  it("uses a short-lived signed URL for private playback", async () => {
    const fake = fakeClient();
    fake.client.storage.from.mockReturnValue({
      upload: fake.upload,
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/video" }, error: null })
    });
    const service = createCloudVideoService(fake.client);

    await expect(service.playbackUrl("athlete-1/video-1/original.mp4", 90)).resolves.toBe("https://signed.example/video");
    expect(fake.client.storage.from().createSignedUrl).toHaveBeenCalledWith("athlete-1/video-1/original.mp4", 90);
  });
});
