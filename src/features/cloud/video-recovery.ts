import type { VideoAnalysis } from "../../lib/training";
import type { RequestVideoAnalysis } from "./cloud-video";

type ReconciledUpload = { videoId: string; path: string };

/** Completes only recovery records whose owned upload was verified by the cloud service. */
export async function reconcileUploadedVideoRecovery(
  video: VideoAnalysis,
  dependencies: {
    reconciledUpload(videoId: string): Promise<ReconciledUpload | null>;
    requestAnalysis: RequestVideoAnalysis;
    persistUploaded(videoId: string, path: string): boolean;
    deleteBlob(videoId: string): Promise<void>;
  }
): Promise<boolean> {
  if (!video.cloud || video.cloud.uploadStatus === "uploaded") return false;
  const uploaded = await dependencies.reconciledUpload(video.cloud.id);
  if (!uploaded) return false;
  await dependencies.requestAnalysis(uploaded.videoId, `${video.id}:first-analysis`);
  if (!dependencies.persistUploaded(video.id, uploaded.path)) return false;
  await dependencies.deleteBlob(video.id);
  return true;
}
