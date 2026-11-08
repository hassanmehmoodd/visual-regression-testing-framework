import { expect, test } from '../../src/fixtures/visual';
import { compareImages } from '../../src/comparison/engine';

const masks = ['[data-vrt="timestamp"]', '[data-vrt="random-id"]', '[data-vrt="avatar"]', '[data-vrt="ad"]'];

test('masked dynamic content does not change the screenshot', async ({ visual }) => {
  const capture = { viewport: 'desktop' as const, fullPage: false, goto: '/' };
  const firstMasked = await visual.capture({ ...capture, masks });
  const firstRaw = await visual.capture({ ...capture, masks: [] });
  const secondMasked = await visual.capture({ ...capture, masks });
  const secondRaw = await visual.capture({ ...capture, masks: [] });

  const masked = await compareImages(firstMasked, secondMasked, {
    threshold: 0.1,
    maxDiffPixelRatio: 0.002,
    maxDiffPixels: null,
    ignoreAntialiasing: true,
    padDimensionMismatch: false,
  });
  expect(masked.status, masked.message).toBe('passed');
  expect(masked.diffPixelRatio).toBeLessThanOrEqual(0.002);

  let rawDiff = 0;
  let previous = firstRaw;
  let latest = secondRaw;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const raw = await compareImages(previous, latest, {
      threshold: 0,
      maxDiffPixelRatio: 0,
      maxDiffPixels: 0,
      ignoreAntialiasing: false,
      padDimensionMismatch: false,
    });
    rawDiff = raw.diffPixels;
    if (rawDiff > 0) {
      break;
    }
    previous = latest;
    latest = await visual.capture({ ...capture, masks: [] });
  }
  expect(rawDiff).toBeGreaterThan(100);
});
