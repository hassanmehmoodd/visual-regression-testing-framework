import type { VisualCheckResult } from '../../src/model';

export function sampleResult(overrides: Partial<VisualCheckResult> = {}): VisualCheckResult {
  const result: VisualCheckResult = {
    key: 'dashboard/full-page/chromium-desktop',
    baselineKey: 'dashboard/full-page/chromium-desktop',
    suite: 'dashboard',
    name: 'full-page',
    label: 'dashboard / full-page',
    browser: 'chromium',
    viewport: 'desktop',
    status: 'passed',
    message: 'Within threshold.',
    diffPixels: 0,
    diffPixelRatio: 0,
    totalPixels: 100,
    threshold: 0.1,
    maxDiffPixelRatio: 0.002,
    maxDiffPixels: null,
    ignoreAntialiasing: true,
    dimensionMismatch: false,
    padded: false,
    baselineWidth: 10,
    baselineHeight: 10,
    actualWidth: 10,
    actualHeight: 10,
    paths: {
      baseline: 'baselines/dashboard/full-page/chromium-desktop.png',
      actual: 'test-results/visual/actual/dashboard/full-page/chromium-desktop.png',
      diff: null,
      pending: null,
    },
    baselineExists: false,
    actualExists: false,
    diffExists: false,
    completedAt: '2026-11-08T00:00:00.000Z',
  };
  return { ...result, ...overrides, paths: { ...result.paths, ...overrides.paths } };
}
