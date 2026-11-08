import { expect, test } from '../../src/fixtures/visual';
import { access } from 'node:fs/promises';
import { loadConfig } from '../../src/config/load-config';
import { BaselineManager } from '../../src/baseline/manager';

test('a missing baseline is reported and is not created', async ({ visual }) => {
  const result = await visual.check({
    suite: 'missing',
    name: 'not-approved',
    viewport: 'desktop',
    fullPage: false,
    goto: '/',
    label: 'Missing baseline',
    updateBaseline: false,
  });

  expect(result.status).toBe('missing-baseline');
  expect(result.baselineExists).toBe(false);
  expect(result.actualExists).toBe(true);
  expect(result.paths.pending).toBeTruthy();
  await access(result.paths.actual);
  if (!result.paths.pending) {
    throw new Error('pending candidate path was not recorded');
  }
  await access(result.paths.pending);
  await expect(access(result.paths.baseline)).rejects.toThrow();

  const manager = new BaselineManager(loadConfig());
  const manifest = await manager.readManifest();
  expect(manifest.baselines[result.baselineKey]).toBeUndefined();
});
