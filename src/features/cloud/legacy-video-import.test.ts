import { describe, expect, it, vi } from "vitest";

import { stageLegacyImportVideos } from "./legacy-video-import";

describe("legacy staged video import", () => {
  it("maps pending schema-3 video IDs to their IndexedDB blobs and uploads each with its original ID", async () => {
    const loadBlob = vi.fn(async (id: string) => id === "video-1" ? new Blob(["clip"], { type: "video/mp4" }) : undefined);
    const upload = vi.fn(async () => ({ videoId: "video-1", path: "athlete-1/video-1/original.mp4" }));

    await expect(stageLegacyImportVideos({
      pendingVideoIds: ["video-1"],
      videos: [{ id: "video-1", fileName: "attempt.mp4", duration: 12 }],
      loadBlob,
      upload
    })).resolves.toEqual(["video-1"]);

    expect(loadBlob).toHaveBeenCalledWith("video-1");
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ name: "attempt.mp4", type: "video/mp4" }), { videoId: "video-1", durationSeconds: 12 });
  });

  it("does not upload or complete when a pending blob is unavailable", async () => {
    const upload = vi.fn();

    await expect(stageLegacyImportVideos({
      pendingVideoIds: ["video-1"],
      videos: [{ id: "video-1", fileName: "attempt.mp4", duration: 12 }],
      loadBlob: async () => undefined,
      upload
    })).rejects.toEqual({ code: "legacy_video_unavailable", videoId: "video-1" });

    expect(upload).not.toHaveBeenCalled();
  });
});
