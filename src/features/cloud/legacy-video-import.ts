type LegacyVideo = { id: string; fileName: string; duration: number };

type LegacyVideoImport = {
  pendingVideoIds: string[];
  videos: LegacyVideo[];
  loadBlob: (id: string) => Promise<Blob | undefined>;
  upload: (file: File, options: { videoId: string; durationSeconds?: number }) => Promise<{ videoId: string }>;
};

function videoFile(blob: Blob, video: LegacyVideo): File {
  if (blob instanceof File && blob.name === video.fileName) return blob;
  return new File([blob], video.fileName, { type: blob.type || `video/${video.fileName.split(".").pop()}` });
}

/** Uploads only the receipt's exact legacy IDs; cloud upload verifies the private object before resolving. */
export async function stageLegacyImportVideos({ pendingVideoIds, videos, loadBlob, upload }: LegacyVideoImport): Promise<string[]> {
  const videosById = new Map(videos.map((video) => [video.id, video]));
  for (const videoId of pendingVideoIds) {
    const video = videosById.get(videoId);
    const blob = video && await loadBlob(videoId);
    if (!video || !blob) throw { code: "legacy_video_unavailable", videoId };
    const uploaded = await upload(videoFile(blob, video), { videoId, ...(video.duration ? { durationSeconds: video.duration } : {}) });
    if (uploaded.videoId !== videoId) throw { code: "legacy_video_unavailable", videoId };
  }
  return [...pendingVideoIds];
}
