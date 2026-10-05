/**
 * Avatar limits.
 *
 * The web client normalises an image to a square WebP before uploading, so
 * 2 MB is generous for a 512×512 avatar and still refuses a raw phone photo
 * that someone might send straight from the file picker of another client.
 */
export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Accepted upload types. SVG is deliberately absent: it is an executable
 * document, and serving it from the API origin would turn an avatar upload
 * into a stored XSS vector.
 */
export const AVATAR_ALLOWED_MIME_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
] as const;

export const AVATAR_SCOPE_TYPE = 'users';
export const AVATAR_STORAGE_FOLDER = 'avatars';

/** Query parameter that busts caches when the avatar is replaced. */
export const AVATAR_VERSION_PARAM = 'v';
