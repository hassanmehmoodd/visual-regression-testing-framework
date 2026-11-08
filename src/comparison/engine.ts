import pixelmatch from 'pixelmatch';
import { VrtError } from '../errors';
import { decodePng, encodePng, padImage, type RawImage } from './image';

export interface CompareOptions {
  threshold: number;
  maxDiffPixelRatio: number;
  maxDiffPixels: number | null;
  ignoreAntialiasing: boolean;
  padDimensionMismatch: boolean;
}

export interface ComparisonResult {
  status: 'passed' | 'failed' | 'dimension-mismatch';
  message: string;
  diffPixels: number;
  diffPixelRatio: number;
  totalPixels: number;
  threshold: number;
  maxDiffPixelRatio: number;
  maxDiffPixels: number | null;
  ignoreAntialiasing: boolean;
  dimensionMismatch: boolean;
  padded: boolean;
  baselineWidth: number;
  baselineHeight: number;
  actualWidth: number;
  actualHeight: number;
  width: number;
  height: number;
  diffPng: Buffer | null;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(4)}%`;
}

function budgetText(options: CompareOptions): string {
  const ratio = `max diff ratio ${formatPercent(options.maxDiffPixelRatio)}`;
  const pixels = options.maxDiffPixels === null ? '' : `, max diff pixels ${options.maxDiffPixels}`;
  const aa = options.ignoreAntialiasing ? 'anti-aliasing ignored' : 'anti-aliasing counted';
  return `Per-pixel threshold ${options.threshold}, ${ratio}${pixels}, ${aa}.`;
}

function exceedsBudget(diffPixels: number, ratio: number, options: CompareOptions): boolean {
  if (ratio > options.maxDiffPixelRatio) {
    return true;
  }
  if (options.maxDiffPixels !== null && diffPixels > options.maxDiffPixels) {
    return true;
  }
  return false;
}

function validateOptions(options: CompareOptions): void {
  if (options.threshold < 0 || options.threshold > 1) {
    throw new VrtError(`threshold must be between 0 and 1. Received ${options.threshold}.`);
  }
  if (options.maxDiffPixelRatio < 0 || options.maxDiffPixelRatio > 1) {
    throw new VrtError(`maxDiffPixelRatio must be between 0 and 1. Received ${options.maxDiffPixelRatio}.`);
  }
  if (options.maxDiffPixels !== null && (!Number.isInteger(options.maxDiffPixels) || options.maxDiffPixels < 0)) {
    throw new VrtError('maxDiffPixels must be a non-negative integer or null.');
  }
}

function compareRaws(baseline: RawImage, actual: RawImage, options: CompareOptions): {
  diffPixels: number;
  diffPng: Buffer;
} {
  const diffRaw = Buffer.alloc(baseline.width * baseline.height * 4);
  // pixelmatch's includeAA flag means "count anti-aliased pixels".
  // ignoreAntialiasing inverts that so the public option reads as tolerance.
  const diffPixels = pixelmatch(baseline.data, actual.data, diffRaw, baseline.width, baseline.height, {
    threshold: options.threshold,
    includeAA: !options.ignoreAntialiasing,
    alpha: 0.1,
    diffColor: [255, 0, 60],
    aaColor: [255, 176, 0],
  });
  return { diffPixels, diffPng: encodePng(baseline.width, baseline.height, diffRaw) };
}

export async function compareImages(
  baselinePng: Buffer,
  actualPng: Buffer,
  options: CompareOptions,
): Promise<ComparisonResult> {
  validateOptions(options);
  const baseline = decodePng(baselinePng);
  const actual = decodePng(actualPng);
  const dimensionMismatch = baseline.width !== actual.width || baseline.height !== actual.height;
  const shared = {
    threshold: options.threshold,
    maxDiffPixelRatio: options.maxDiffPixelRatio,
    maxDiffPixels: options.maxDiffPixels,
    ignoreAntialiasing: options.ignoreAntialiasing,
    dimensionMismatch,
    baselineWidth: baseline.width,
    baselineHeight: baseline.height,
    actualWidth: actual.width,
    actualHeight: actual.height,
  };

  if (dimensionMismatch && !options.padDimensionMismatch) {
    return {
      ...shared,
      status: 'dimension-mismatch',
      padded: false,
      diffPixels: 0,
      diffPixelRatio: 0,
      totalPixels: 0,
      width: 0,
      height: 0,
      diffPng: null,
      message:
        `Dimension mismatch: baseline is ${baseline.width}×${baseline.height} and actual is ${actual.width}×${actual.height}. ` +
        'Diff image was not written. Enable padDimensionMismatch to render a padded diff.',
    };
  }

  let left = baseline;
  let right = actual;
  let padded = false;
  if (dimensionMismatch) {
    const width = Math.max(baseline.width, actual.width);
    const height = Math.max(baseline.height, actual.height);
    left = await padImage(baseline, width, height);
    right = await padImage(actual, width, height);
    padded = true;
  }

  const compared = compareRaws(left, right, options);
  const totalPixels = left.width * left.height;
  const diffPixelRatio = totalPixels === 0 ? 0 : compared.diffPixels / totalPixels;
  const overBudget = exceedsBudget(compared.diffPixels, diffPixelRatio, options);
  const details =
    `${compared.diffPixels} differing pixels (${formatPercent(diffPixelRatio)} of ${totalPixels}). ${budgetText(options)}`;

  if (dimensionMismatch) {
    return {
      ...shared,
      status: 'dimension-mismatch',
      padded,
      diffPixels: compared.diffPixels,
      diffPixelRatio,
      totalPixels,
      width: left.width,
      height: left.height,
      diffPng: compared.diffPng,
      message:
        `Dimension mismatch: baseline is ${baseline.width}×${baseline.height} and actual is ${actual.width}×${actual.height}. ` +
        'A padded diff was written; magenta padding marks the area present in only one image. ' +
        `Padded comparison shows ${details}`,
    };
  }

  return {
    ...shared,
    status: overBudget ? 'failed' : 'passed',
    padded: false,
    diffPixels: compared.diffPixels,
    diffPixelRatio,
    totalPixels,
    width: left.width,
    height: left.height,
    diffPng: compared.diffPng,
    message: overBudget ? `Pixel diff exceeded the threshold: ${details}` : `Within threshold: ${details}`,
  };
}
