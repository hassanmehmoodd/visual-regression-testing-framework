import { expect, test } from '../../src/fixtures/visual';

const variants = [
  ['color', 'Color'],
  ['font', 'Font'],
  ['spacing', 'Spacing'],
  ['size', 'Component size'],
  ['layout', 'Layout'],
  ['missing', 'Missing element'],
] as const;

for (const [variant, label] of variants) {
  test(`detects a ${label.toLowerCase()} change`, async ({ visual }) => {
    const result = await visual.check({
      suite: 'changes',
      name: variant,
      label: `${label} change`,
      viewport: 'desktop',
      fullPage: true,
      goto: `/?variant=${variant}`,
      baseline: { suite: 'dashboard', name: 'full-page' },
      updateBaseline: false,
    });
    expect(result.status, result.message).toBe('failed');
    expect(result.diffPixels).toBeGreaterThan(0);
    expect(result.dimensionMismatch).toBe(false);
    expect(result.diffExists).toBe(true);
    expect(result.baselineExists).toBe(true);
  });
}
