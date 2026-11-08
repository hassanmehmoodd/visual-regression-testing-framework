import type { CompareOptions } from '../../src/comparison/engine';

export function compareOptions(overrides: Partial<CompareOptions> = {}): CompareOptions {
  return {
    threshold: 0,
    maxDiffPixelRatio: 0,
    maxDiffPixels: null,
    ignoreAntialiasing: false,
    padDimensionMismatch: false,
    ...overrides,
  };
}
