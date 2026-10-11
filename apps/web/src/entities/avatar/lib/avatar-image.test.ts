import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AVATAR_OUTPUT_SIZE,
  clampCropArea,
  renderCroppedAvatar,
} from "./avatar-image";

type StubCanvas = {
  width: number;
  height: number;
  getContext: ReturnType<typeof vi.fn>;
  toBlob: ReturnType<typeof vi.fn>;
};

function stubCanvas() {
  const drawImage = vi.fn();
  const canvas: StubCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toBlob: vi.fn((callback: BlobCallback) => callback(new Blob())),
  };

  return { canvas, drawImage };
}

/** jsdom has no canvas implementation, so both canvases are handed out in order. */
function stubCanvasFactory(canvases: StubCanvas[]) {
  let call = 0;

  vi.spyOn(document, "createElement").mockImplementation((() => {
    const canvas = canvases[call];
    call += 1;
    return canvas as unknown as HTMLElement;
  }) as typeof document.createElement);
}

function stubImage(
  naturalWidth: number,
  naturalHeight: number,
): HTMLImageElement {
  return { naturalWidth, naturalHeight } as HTMLImageElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clampCropArea", () => {
  it("keeps a crop that fits inside the image", () => {
    const crop = { x: 10, y: 20, width: 100, height: 100 };

    expect(clampCropArea(crop, { width: 4000, height: 3000 })).toEqual(crop);
  });

  it("pulls a negative origin back to zero", () => {
    expect(
      clampCropArea(
        { x: -50, y: -20, width: 100, height: 100 },
        { width: 4000, height: 3000 },
      ),
    ).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it("shrinks a crop that runs past the right and bottom edges", () => {
    expect(
      clampCropArea(
        { x: 3900, y: 2900, width: 500, height: 500 },
        { width: 4000, height: 3000 },
      ),
    ).toEqual({ x: 3900, y: 2900, width: 100, height: 100 });
  });

  it("collapses a crop that starts outside the image instead of drawing nothing", () => {
    expect(
      clampCropArea(
        { x: 5000, y: 5000, width: 100, height: 100 },
        { width: 4000, height: 3000 },
      ),
    ).toEqual({ x: 4000, y: 3000, width: 0, height: 0 });
  });
});

describe("renderCroppedAvatar", () => {
  /**
   * `react-easy-crop` already reports the crop in the natural coordinates of the
   * image. Scaling it a second time pushed the crop outside the canvas, and
   * `drawImage` then produced a fully transparent avatar instead of failing.
   */
  it("uses the reported crop as is, without rescaling it", async () => {
    const source = stubCanvas();
    const target = stubCanvas();
    stubCanvasFactory([source.canvas, target.canvas]);

    await renderCroppedAvatar(stubImage(4000, 3000), {
      x: 1200,
      y: 800,
      width: 1000,
      height: 1000,
    });

    expect(target.drawImage).toHaveBeenCalledWith(
      source.canvas,
      1200,
      800,
      1000,
      1000,
      0,
      0,
      AVATAR_OUTPUT_SIZE,
      AVATAR_OUTPUT_SIZE,
    );
  });

  it("copies the source image onto a canvas of its natural size first", async () => {
    const source = stubCanvas();
    const target = stubCanvas();
    stubCanvasFactory([source.canvas, target.canvas]);

    const image = stubImage(4000, 3000);
    await renderCroppedAvatar(image, { x: 0, y: 0, width: 100, height: 100 });

    expect(source.canvas.width).toBe(4000);
    expect(source.canvas.height).toBe(3000);
    expect(source.drawImage).toHaveBeenCalledWith(image, 0, 0);
  });

  it("clamps the crop to the image instead of producing an empty avatar", async () => {
    const source = stubCanvas();
    const target = stubCanvas();
    stubCanvasFactory([source.canvas, target.canvas]);

    await renderCroppedAvatar(stubImage(4000, 3000), {
      x: 3900,
      y: 2900,
      width: 500,
      height: 500,
    });

    expect(target.drawImage).toHaveBeenCalledWith(
      source.canvas,
      3900,
      2900,
      100,
      100,
      0,
      0,
      AVATAR_OUTPUT_SIZE,
      AVATAR_OUTPUT_SIZE,
    );
  });
});
