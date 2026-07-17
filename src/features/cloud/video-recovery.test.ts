import { describe, expect, it, vi } from "vitest";

import { reconcileUploadedVideoRecovery } from "./video-recovery";

const video = {
  id: "video-1",
  sessionId: "w1d1",
  createdAt: "2026-07-15T00:00:00.000Z",
  fileName: "attempt.mp4",
  duration: 12,
  size: 4,
  notes: "right foot cuts",
  footCuts: 2,
  swing: 1,
  hips: 3,
  shoulder: 0,
  breath: 1,
  reading: 2,
  advice: [{ title: "Feet", body: "Stay active." }],
  cloud: { id: "video-1", path: "athlete-1/video-1/original.mp4", uploadStatus: "pending" as const }
};

describe("reconcileUploadedVideoRecovery", () => {
  it("requests an idempotent job before completing a reload that crashed after upload", async () => {
    const order: string[] = [];
    const requestAnalysis = vi.fn(async () => { order.push("request"); return "job-1"; });
    const persistUploaded = vi.fn(() => { order.push("persist"); return true; });
    const deleteBlob = vi.fn(async () => { order.push("delete"); });

    await expect(reconcileUploadedVideoRecovery(video, {
      reconciledUpload: vi.fn(async () => ({ videoId: "video-1", path: "athlete-1/video-1/original.mp4" })),
      requestAnalysis,
      persistUploaded,
      deleteBlob
    })).resolves.toBe(true);

    expect(requestAnalysis).toHaveBeenCalledWith("video-1", "video-1:first-analysis");
    expect(order).toEqual(["request", "persist", "delete"]);
  });

  it("keeps the recovery blob when requesting the analysis fails", async () => {
    const persistUploaded = vi.fn(() => true);
    const deleteBlob = vi.fn();

    await expect(reconcileUploadedVideoRecovery(video, {
      reconciledUpload: async () => ({ videoId: "video-1", path: "athlete-1/video-1/original.mp4" }),
      requestAnalysis: async () => { throw new Error("offline"); },
      persistUploaded,
      deleteBlob
    })).rejects.toThrow("offline");

    expect(persistUploaded).not.toHaveBeenCalled();
    expect(deleteBlob).not.toHaveBeenCalled();
  });
});
