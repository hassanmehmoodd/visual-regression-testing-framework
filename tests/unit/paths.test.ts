import assert from 'node:assert/strict';
import test from 'node:test';
import { screenshotFile, screenshotKey } from '../../src/baseline/paths';

const id = { suite: 'dashboard', name: 'full-page', browser: 'chromium', viewport: 'desktop' };

test('screenshot names are suite/test/browser-viewport', () => {
  assert.equal(screenshotKey(id, false), 'dashboard/full-page/chromium-desktop');
  assert.equal(screenshotKey({ ...id, browser: 'firefox' }, false), 'dashboard/full-page/firefox-desktop');
  assert.equal(screenshotKey({ ...id, browser: 'webkit' }, false), 'dashboard/full-page/webkit-desktop');
  assert.match(screenshotFile('/tmp/baselines', id, false), /dashboard\/full-page\/chromium-desktop\.png$/);
});

test('platform suffix is opt-in', () => {
  assert.equal(screenshotKey(id, true, 'linux'), 'dashboard/full-page/chromium-desktop-linux');
  assert.equal(screenshotKey(id, false, 'linux'), 'dashboard/full-page/chromium-desktop');
});

test('path segments reject traversal', () => {
  assert.throws(() => screenshotKey({ ...id, suite: '../secret' }, false), /suite/);
  assert.throws(() => screenshotKey({ ...id, name: 'a/b' }, false), /name/);
});
