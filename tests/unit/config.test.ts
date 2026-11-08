import assert from 'node:assert/strict';
import test from 'node:test';
import { selectedBrowsers } from '../../src/config/browsers';
import { resolveConfig } from '../../src/config/resolve';

test('environment overrides win over the config file values', () => {
  const config = resolveConfig(
    { threshold: 0.2, maxDiffPixelRatio: 0.2, approver: 'From File' },
    {
      VRT_THRESHOLD: '0.05',
      VRT_MAX_DIFF_RATIO: '0.5',
      VRT_UPDATE_BASELINES: 'yes',
      VRT_IGNORE_ANTIALIASING: 'false',
      VRT_VIEWPORT_MOBILE: '400x700',
      VRT_APPROVER: 'Env Approver',
      VRT_BROWSERS: 'webkit,chromium,webkit',
    },
  );
  assert.equal(config.threshold, 0.05);
  assert.equal(config.maxDiffPixelRatio, 0.5);
  assert.equal(config.updateBaselines, true);
  assert.equal(config.ignoreAntialiasing, false);
  assert.deepEqual(config.viewports.mobile, { width: 400, height: 700 });
  assert.equal(config.approver, 'Env Approver');
  assert.deepEqual(selectedBrowsers({ VRT_BROWSERS: 'webkit,chromium,webkit' }), ['webkit', 'chromium']);
});

test('invalid configuration is rejected', () => {
  assert.throws(() => resolveConfig({}, { VRT_THRESHOLD: '2' }), /threshold/);
  assert.throws(() => resolveConfig({}, { VRT_UPDATE_BASELINES: 'maybe' }), /boolean/);
  assert.throws(() => resolveConfig({}, { VRT_VIEWPORT_DESKTOP: 'wide' }), /1280x800/);
  assert.throws(() => selectedBrowsers({ VRT_BROWSERS: 'opera' }), /Unsupported browser/);
});
