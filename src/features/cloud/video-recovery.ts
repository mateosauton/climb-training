import type { VideoAnalysis } from "../../lib/training";
import type { AppendVideoAnalysis, VideoAnalysisPayload } from "./cloud-video";

type ReconciledUpload = { videoId: string; path: string };

export function videoAnalysisPayload(video: VideoAnalysis): VideoAnalysisPayload {
  return {
    status: "completed",
    metrics: {
      session_id: video.sessionId,
      notes: video.notes,
      foot_cuts: video.footCuts,
      swing: video.swing,
      hips: video.hips,
      shoulder: video.shoulder,
      breath: video.breath,
      reading: video.reading
    },
    advice: { recommendations: video.advice }
  };
}

/** Completes only recovery records whose owned upload was verified by the cloud service. */
export async function reconcileUploadedVideoRecovery(
  video: VideoAnalysis,
  dependencies: {
    reconciledUpload(videoId: string): Promise<ReconciledUpload | null>;
    appendAnalysis: AppendVideoAnalysis;
    persistUploaded(videoId: string, path: string): boolean;
    deleteBlob(videoId: string): Promise<void>;
  }
): Promise<boolean> {
  if (!video.cloud || video.cloud.uploadStatus === "uploaded") return false;
  const uploaded = await dependencies.reconciledUpload(video.cloud.id);
  if (!uploaded) return false;
  await dependencies.appendAnalysis(uploaded.videoId, videoAnalysisPayload(video));
  if (!dependencies.persistUploaded(video.id, uploaded.path)) return false;
  await dependencies.deleteBlob(video.id);
  return true;
}
