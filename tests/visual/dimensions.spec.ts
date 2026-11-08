import { expect, test } from '../../src/fixtures/visual';
import { access } from 'node:fs/promises';

test('a differently sized baseline is reported as a dimension mismatch', async ({ visual }) => {
  const result = await visual.check({
    suite: 'dimensions',
    name: 'mismatch',
    viewport: 'desktop',
    fullPage: false,
    goto: '/',
    label: 'Dimension mismatch',
    updateBaseline: false,
  });

  expect(result.status, result.message).toBe('dimension-mismatch');
  expect(result.dimensionMismatch).toBe(true);
  expect(result.padded).toBe(true);
  expect(result.baselineWidth).toBe(48);
  expect(result.baselineHeight).toBe(48);
  expect(result.actualWidth).toBe(1280);
  expect(result.actualHeight).toBe(800);
  expect(result.diffExists).toBe(true);
  if (!result.paths.diff) {
    throw new Error('padded diff was not recorded');
  }
  await access(result.paths.diff);
  expect(result.message).toContain('48×48');
  expect(result.message).toContain('1280×800');
});
