import { expect, test } from '../../src/fixtures/visual';

const shared = {
  viewport: 'desktop' as const,
  fullPage: true,
  goto: '/?variant=color',
  baseline: { suite: 'dashboard', name: 'full-page' },
  updateBaseline: false,
  threshold: 0,
  ignoreAntialiasing: false,
};

test('a loose per-check threshold accepts a diff that a strict threshold rejects', async ({ visual }) => {
  const loose = await visual.check({
    ...shared,
    suite: 'threshold',
    name: 'loose',
    label: 'Loose threshold',
    maxDiffPixelRatio: 1,
    maxDiffPixels: null,
  });
  const strict = await visual.check({
    ...shared,
    suite: 'threshold',
    name: 'strict',
    label: 'Strict threshold',
    maxDiffPixelRatio: 0,
    maxDiffPixels: 0,
  });

  expect(loose.status, loose.message).toBe('passed');
  expect(strict.status, strict.message).toBe('failed');
  expect(strict.diffPixels).toBeGreaterThan(0);
  expect(strict.diffPixels).toBe(loose.diffPixels);
  expect(strict.dimensionMismatch).toBe(false);
});
