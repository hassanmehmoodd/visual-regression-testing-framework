import { PNG } from 'pngjs';
import sharp from 'sharp';
import { VrtError } from '../errors';

export interface RawImage {
  width: number;
  height: number;
  data: Buffer;
}

const MAX_DIMENSION = 8000;

function assertDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new VrtError(`Image dimensions must be positive integers. Received ${width}x${height}.`);
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new VrtError(`Image dimensions exceed ${MAX_DIMENSION}px. Received ${width}x${height}.`);
  }
}

export function decodePng(buffer: Buffer): RawImage {
  let png: PNG;
  try {
    png = PNG.sync.read(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VrtError(`Could not decode PNG: ${message}`);
  }
  assertDimensions(png.width, png.height);
  return {
    width: png.width,
    height: png.height,
    data: Buffer.from(png.data),
  };
}

export function encodePng(width: number, height: number, data: Buffer): Buffer {
  assertDimensions(width, height);
  const expected = width * height * 4;
  if (data.length !== expected) {
    throw new VrtError(`RGBA buffer length ${data.length} does not match ${width}x${height} (${expected} bytes).`);
  }
  const png = new PNG({ width, height });
  data.copy(png.data);
  return PNG.sync.write(png);
}

export function createSolidPng(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): Buffer {
  assertDimensions(width, height);
  const data = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set(rgba, offset);
  }
  return encodePng(width, height, data);
}

export async function padImage(image: RawImage, width: number, height: number): Promise<RawImage> {
  assertDimensions(width, height);
  if (width < image.width || height < image.height) {
    throw new VrtError(
      `padImage target ${width}x${height} is smaller than the source ${image.width}x${image.height}.`,
    );
  }
  if (width === image.width && height === image.height) {
    return image;
  }

  const { data, info } = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .extend({
      top: 0,
      bottom: height - image.height,
      left: 0,
      right: width - image.width,
      background: { r: 255, g: 0, b: 255, alpha: 1 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== width || info.height !== height || info.channels !== 4) {
    throw new VrtError(
      `sharp returned ${info.width}x${info.height} channels=${info.channels}, expected ${width}x${height} channels=4.`,
    );
  }

  return { width: info.width, height: info.height, data };
}
