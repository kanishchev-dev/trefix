import { ApiClientError, avatarUploadSchema } from "@workspace/api-client";

export const avatarPaths = {
  /** Self-service upload of the own avatar. */
  own: "/api/admin/avatars/me",
  /** Administrator upload on behalf of any user. */
  forUser: (userId: string) => `/api/admin/avatars/${userId}`,
} as const;

/**
 * Sends the cropped image as multipart and returns the URL the backend built.
 *
 * `fetch` is used directly rather than the shared JSON helper: that one always
 * sets `content-type: application/json`, which would corrupt the multipart
 * boundary and leave the backend with an empty file.
 */
async function postAvatar(
  path: string,
  file: Blob,
): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("file", file, "avatar.webp");

  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;

    throw new ApiClientError(
      errorBody?.message || `Request failed with status ${response.status}`,
      response.status,
      errorBody?.code,
      errorBody,
    );
  }

  return avatarUploadSchema.parse(await response.json());
}

/**
 * Uploads the own avatar.
 *
 * The blob arrives already cropped and downscaled by the client, so the backend
 * does no image processing of its own.
 */
export function uploadOwnAvatar(file: Blob): Promise<{ avatarUrl: string }> {
  return postAvatar(avatarPaths.own, file);
}

/** Uploads the avatar of another user; requires `users.update`. */
export function uploadUserAvatar(
  userId: string,
  file: Blob,
): Promise<{ avatarUrl: string }> {
  return postAvatar(avatarPaths.forUser(userId), file);
}
