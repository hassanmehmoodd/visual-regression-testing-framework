import { expect, test } from '../../src/fixtures/visual';
import { expectStable } from './expect-match';

for (const viewport of ['tablet', 'mobile'] as const) {
  test(`full page matches the ${viewport} baseline`, async ({ visual }, testInfo) => {
    const result = await visual.check({
      suite: 'dashboard',
      name: 'responsive',
      viewport,
      fullPage: true,
      goto: '/',
      label: `Dashboard ${viewport}`,
    });
    expectStable(result);
    expect(result.viewport).toBe(viewport);
    expect(result.key).toBe(`dashboard/responsive/${testInfo.project.name}-${viewport}`);
  });
}
