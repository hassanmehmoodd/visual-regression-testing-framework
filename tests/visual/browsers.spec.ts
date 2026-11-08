import { expect, test } from '../../src/fixtures/visual';
import { expectStable } from './expect-match';

test('full page matches the browser-specific baseline @cross-browser', async ({ visual }, testInfo) => {
  const result = await visual.check({
    suite: 'dashboard',
    name: 'full-page',
    viewport: 'desktop',
    fullPage: true,
    goto: '/',
    label: 'Dashboard full page',
  });
  expectStable(result);
  expect(result.browser).toBe(testInfo.project.name);
  expect(result.key).toBe(`dashboard/full-page/${testInfo.project.name}-desktop`);
  expect(result.baselineExists).toBe(true);
});
