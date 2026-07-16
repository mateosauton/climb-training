const AVATAR_BUCKET = "profile-photos";
const AVATAR_EXPIRY_SECONDS = 60;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const extensionsByMime = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

type CloudResult<T = unknown> = { data: T; error: unknown | null };
export type AvatarFile = Blob & { name: string; type: string; size: number };

export interface CloudAvatarClient {
  storage: {
    from(bucket: typeof AVATAR_BUCKET): {
      upload(path: string, file: AvatarFile, options: { contentType: string; upsert: boolean }): PromiseLike<CloudResult>;
      createSignedUrl(path: string, expiresIn: number): PromiseLike<CloudResult<{ signedUrl: string } | null>>;
    };
  };
}

export function validateAvatarFile(file: AvatarFile): "jpg" | "png" | "webp" {
  const extension = extensionsByMime[file.type as keyof typeof extensionsByMime];
  if (!extension) throw new Error("invalid_avatar_file");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("avatar_too_large");
  return extension;
}

export function avatarPath(athleteId: string, file: AvatarFile): string {
  if (!athleteId.trim()) throw new Error("invalid_avatar_path");
  return `${athleteId}/avatar.${validateAvatarFile(file)}`;
}

export async function uploadAvatar(client: CloudAvatarClient, athleteId: string, file: AvatarFile): Promise<string> {
  const path = avatarPath(athleteId, file);
  const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true
  });
  if (error) throw { code: "unavailable" };
  return path;
}

export async function createAvatarSignedUrl(client: CloudAvatarClient, path: string): Promise<string> {
  const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) throw { code: "unavailable" };
  return data.signedUrl;
}
