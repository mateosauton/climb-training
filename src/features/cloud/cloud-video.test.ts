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

function fakeClient({ uploadError, metadataError, asset, objects }: { uploadError?: unknown; metadataError?: unknown; asset?: Record<string, unknown> | null; objects?: Array<Record<string, unknown>> } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError ?? null });
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const insert = vi.fn().mockResolvedValue({ error: metadataError ?? null });
  const defaultAsset = { id: "video-1", athlete_id: "athlete-1", object_path: "athlete-1/video-1/original.mp4", checksum: "a".repeat(64), byte_size: 4, upload_status: "uploaded" };
  const maybeSingle = asset === undefined
    ? vi.fn().mockResolvedValueOnce({ data: null, error: null }).mockResolvedValue({ data: defaultAsset, error: null })
    : vi.fn().mockResolvedValue({ data: asset, error: null });
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  const list = vi.fn().mockResolvedValue({ data: objects ?? [{ name: "original.mp4", metadata: { size: 4 } }], error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "athlete-1" } }, error: null }) },
      storage: { from: vi.fn().mockReturnValue({ upload, createSignedUrl: vi.fn(), list }) },
      from: vi.fn().mockReturnValue({ insert, update, select }),
      rpc
    },
    upload,
    insert,
    update,
    list,
    rpc
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
    const fake = fakeClient({ asset: { id: "video-1", athlete_id: "athlete-1", object_path: "athlete-1/video-1/original.mp4", checksum: "a".repeat(64), byte_size: 4, upload_status: "uploaded" } });
    fake.client.storage.from.mockReturnValue({
      upload: fake.upload,
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/video" }, error: null })
    });
    const service = createCloudVideoService(fake.client);

    await expect(service.playbackUrl("video-1")).resolves.toBe("https://signed.example/video");
    expect(fake.client.from).toHaveBeenCalledWith("video_assets");
    expect(fake.client.storage.from().createSignedUrl).toHaveBeenCalledWith("athlete-1/video-1/original.mp4", 60);
  });

  it("does not confirm an upload or discard recovery data when cloud metadata and object disagree", async () => {
    const fake = fakeClient({
      asset: { id: "video-1", athlete_id: "athlete-1", object_path: "athlete-1/video-1/original.mp4", checksum: "a".repeat(64), byte_size: 4, upload_status: "pending" },
      objects: []
    });
    const service = createCloudVideoService(fake.client, { createId: () => "video-1", checksum: vi.fn().mockResolvedValue("a".repeat(64)) });
    const file = new File(["clip"], "attempt.mp4", { type: "video/mp4" });

    await expect(service.upload(file, { videoId: "video-1" })).rejects.toEqual({ code: "upload_pending", videoId: "video-1", path: "athlete-1/video-1/original.mp4" });
  });

  it("rejects a retry whose file checksum differs from its pending metadata", async () => {
    const fake = fakeClient({ asset: { id: "video-1", athlete_id: "athlete-1", object_path: "athlete-1/video-1/original.mp4", checksum: "b".repeat(64), byte_size: 4, upload_status: "pending" } });
    const service = createCloudVideoService(fake.client, { checksum: vi.fn().mockResolvedValue("a".repeat(64)) });

    await expect(service.upload(new File(["clip"], "attempt.mp4", { type: "video/mp4" }), { videoId: "video-1" })).rejects.toEqual({ code: "file_mismatch", videoId: "video-1", path: "athlete-1/video-1/original.mp4" });
    expect(fake.upload).not.toHaveBeenCalled();
  });

  it("does not upload when pending metadata cannot be created or confirmed", async () => {
    const fake = fakeClient({ metadataError: { message: "conflict" }, asset: null });
    const service = createCloudVideoService(fake.client, { createId: () => "video-1", checksum: vi.fn().mockResolvedValue("a".repeat(64)) });

    await expect(service.upload(new File(["clip"], "attempt.mp4", { type: "video/mp4" }))).rejects.toEqual({ code: "unavailable", videoId: "video-1", path: "athlete-1/video-1/original.mp4" });
    expect(fake.upload).not.toHaveBeenCalled();
  });

  it("appends every analysis through the JWT-bound RPC without accepting a caller supplied version", async () => {
    const fake = fakeClient();
    const service = createCloudVideoService(fake.client);

    await service.appendAnalysis("video-1", { status: "completed", metrics: { foot_cuts: 2 }, advice: { recommendations: [] } });

    expect(fake.rpc).toHaveBeenCalledWith("append_video_analysis", {
      p_video_asset_id: "video-1",
      p_status: "completed",
      p_metrics: { foot_cuts: 2 },
      p_advice: { recommendations: [] }
    });
  });

  it("refuses signed playback when owned uploaded metadata is unavailable", async () => {
    const fake = fakeClient({ asset: null });
    const service = createCloudVideoService(fake.client);

    await expect(service.playbackUrl("video-1")).rejects.toEqual({ code: "unavailable", videoId: "video-1" });
  });
});
