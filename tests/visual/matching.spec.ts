import { expect, test } from '../../src/fixtures/visual';
import { expectStable } from './expect-match';

test('viewport screenshot matches the approved baseline', async ({ visual }, testInfo) => {
  const result = await visual.check({
    suite: 'dashboard',
    name: 'viewport',
    viewport: 'desktop',
    fullPage: false,
    goto: '/',
    label: 'Dashboard viewport',
  });
  expectStable(result);
  expect(result.key).toBe(`dashboard/viewport/${testInfo.project.name}-desktop`);
  expect(result.actualWidth).toBe(1280);
  expect(result.actualHeight).toBe(800);
});

test('pricing element matches the approved baseline', async ({ visual }, testInfo) => {
  const result = await visual.check({
    suite: 'dashboard',
    name: 'pricing',
    viewport: 'desktop',
    selector: '#pricing',
    goto: '/',
    label: 'Pricing element',
  });
  expectStable(result);
  expect(result.key).toBe(`dashboard/pricing/${testInfo.project.name}-desktop`);
});
