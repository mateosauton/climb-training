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
  it("appends the immutable analysis before completing a reload that crashed after upload", async () => {
    const order: string[] = [];
    const appendAnalysis = vi.fn(async () => { order.push("analysis"); });
    const persistUploaded = vi.fn(() => { order.push("persist"); return true; });
    const deleteBlob = vi.fn(async () => { order.push("delete"); });

    await expect(reconcileUploadedVideoRecovery(video, {
      reconciledUpload: vi.fn(async () => ({ videoId: "video-1", path: "athlete-1/video-1/original.mp4" })),
      appendAnalysis,
      persistUploaded,
      deleteBlob
    })).resolves.toBe(true);

    expect(appendAnalysis).toHaveBeenCalledWith("video-1", {
      status: "completed",
      metrics: {
        session_id: "w1d1", notes: "right foot cuts", foot_cuts: 2, swing: 1,
        hips: 3, shoulder: 0, breath: 1, reading: 2
      },
      advice: { recommendations: [{ title: "Feet", body: "Stay active." }] }
    });
    expect(order).toEqual(["analysis", "persist", "delete"]);
  });

  it("keeps the recovery blob when appending the analysis fails", async () => {
    const persistUploaded = vi.fn(() => true);
    const deleteBlob = vi.fn();

    await expect(reconcileUploadedVideoRecovery(video, {
      reconciledUpload: async () => ({ videoId: "video-1", path: "athlete-1/video-1/original.mp4" }),
      appendAnalysis: async () => { throw new Error("offline"); },
      persistUploaded,
      deleteBlob
    })).rejects.toThrow("offline");

    expect(persistUploaded).not.toHaveBeenCalled();
    expect(deleteBlob).not.toHaveBeenCalled();
  });
});
