/**
 * Avatar image helpers.
 *
 * The browser does the resizing before anything is uploaded: a phone photo is
 * several megabytes, while the avatar is displayed at most at sidebar size.
 * Cropping and re-encoding on the client keeps the upload small and saves the
 * backend from needing a native image library.
 */

/** Edge length of the stored avatar, in pixels. */
export const AVATAR_OUTPUT_SIZE = 512;

/** WebP first, JPEG as a fallback for browsers without WebP encoding. */
export const AVATAR_OUTPUT_MIME = "image/webp";
export const AVATAR_FALLBACK_MIME = "image/jpeg";
export const AVATAR_OUTPUT_QUALITY = 0.85;

/** Input types we let through the picker at all. */
export const AVATAR_ACCEPTED_INPUT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Confines a crop rectangle to the bounds of the source image.
 *
 * `react-easy-crop` already reports `croppedAreaPixels` in the natural
 * coordinates of the image, so they are used as they come. Clamping is only a
 * safety net: `drawImage` silently draws nothing when the source rectangle
 * falls outside the canvas, which produces a fully transparent avatar rather
 * than an error, and that failure is invisible in the UI.
 */
export function clampCropArea(
  crop: CropArea,
  bounds: { width: number; height: number },
): CropArea {
  const x = Math.min(Math.max(0, crop.x), Math.max(0, bounds.width));
  const y = Math.min(Math.max(0, crop.y), Math.max(0, bounds.height));

  return {
    x,
    y,
    width: Math.min(Math.max(0, crop.width), bounds.width - x),
    height: Math.min(Math.max(0, crop.height), bounds.height - y),
  };
}

/**
 * Draws the cropped region of an image into a square canvas and encodes it.
 *
 * `crop` is expected in the natural pixel coordinates of `image`, which is what
 * `react-easy-crop` reports — no conversion to the displayed size.
 *
 * Uses `image/webp` when the browser can encode it and falls back to JPEG, so
 * the result is always a small image regardless of browser support.
 */
export async function renderCroppedAvatar(
  image: HTMLImageElement,
  crop: CropArea,
  outputSize: number = AVATAR_OUTPUT_SIZE,
): Promise<Blob> {
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;

  const sourceContext = source.getContext("2d");
  if (!sourceContext) {
    throw new Error("Canvas 2D context is unavailable");
  }

  sourceContext.drawImage(image, 0, 0);

  const target = document.createElement("canvas");
  target.width = outputSize;
  target.height = outputSize;

  const targetContext = target.getContext("2d");
  if (!targetContext) {
    throw new Error("Canvas 2D context is unavailable");
  }

  const area = clampCropArea(crop, {
    width: image.naturalWidth,
    height: image.naturalHeight,
  });

  // Avatars are cropped square, so the crop is stretched to the square output
  // rather than letterboxed with empty corners.
  targetContext.drawImage(
    source,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return encodeCanvas(target);
}

function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode the cropped avatar"));
          return;
        }

        resolve(blob);
      },
      AVATAR_OUTPUT_MIME,
      AVATAR_OUTPUT_QUALITY,
    );
  });
}

/** Loads a picked file into an `HTMLImageElement`, rejecting on decode errors. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected file could not be read as an image"));
    };

    image.src = url;
  });
}
