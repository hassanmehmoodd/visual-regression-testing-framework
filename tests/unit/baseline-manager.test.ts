import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BaselineManager } from '../../src/baseline/manager';
import { sha256 } from '../../src/baseline/hash';
import { createSolidPng } from '../../src/comparison/image';
import { resolveConfig } from '../../src/config/resolve';
import type { VrtConfig } from '../../src/config/types';
import type { ScreenshotIdentity } from '../../src/model';

const blue = [20, 60, 180, 255] as const;
const red = [200, 30, 40, 255] as const;

async function createFixture(): Promise<{ root: string; config: VrtConfig; manager: BaselineManager; id: ScreenshotIdentity }> {
  const root = await mkdtemp(path.join(tmpdir(), 'vrt-baseline-'));
  const config = resolveConfig({
    baselineDir: path.join(root, 'baselines'),
    actualDir: path.join(root, 'actual'),
    diffDir: path.join(root, 'diff'),
    pendingDir: path.join(root, 'pending'),
    reportDir: path.join(root, 'report'),
    resultsDir: path.join(root, 'results'),
    historyDir: path.join(root, 'history'),
    approver: 'Test Approver',
    masks: [],
    requiredSelectors: [],
    updateBaselines: false,
    maxDiffPixelRatio: 0,
    threshold: 0,
    ignoreAntialiasing: false,
  });
  return {
    root,
    config,
    manager: new BaselineManager(config),
    id: { suite: 'sample', name: 'card', browser: 'chromium', viewport: 'desktop' },
  };
}

test('a missing baseline writes a pending candidate and does not create a baseline', async () => {
  const { manager, id, config } = await createFixture();
  const actual = createSolidPng(12, 12, blue);
  const result = await manager.compare({
    identity: id,
    actual,
    threshold: 0,
    maxDiffPixelRatio: 0,
    maxDiffPixels: null,
    ignoreAntialiasing: false,
    padDimensionMismatch: true,
    updateBaseline: false,
  });

  assert.equal(result.status, 'missing-baseline');
  assert.equal(result.baselineExists, false);
  assert.equal(await exists(path.join(config.baselineDir, 'sample/card/chromium-desktop.png')), false);
  const pending = path.join(config.pendingDir, 'sample/card/chromium-desktop.png');
  assert.equal(sha256(await readFile(pending)), sha256(actual));
  const manifest = await manager.readManifest();
  assert.equal(manifest.baselines[result.baselineKey], undefined);
});

test('update mode creates a missing baseline and refuses to overwrite an approved one', async () => {
  const { manager, id, config } = await createFixture();
  const original = createSolidPng(12, 12, blue);
  const changed = createSolidPng(12, 12, red);
  const created = await manager.compare({
    identity: id,
    actual: original,
    threshold: 0,
    maxDiffPixelRatio: 0,
    maxDiffPixels: null,
    ignoreAntialiasing: false,
    padDimensionMismatch: false,
    updateBaseline: true,
  });
  assert.equal(created.status, 'baseline-created');
  const baselinePath = path.join(config.baselineDir, 'sample/card/chromium-desktop.png');
  const approvedHash = sha256(await readFile(baselinePath));

  const failed = await manager.compare({
    identity: id,
    actual: changed,
    threshold: 0,
    maxDiffPixelRatio: 0,
    maxDiffPixels: null,
    ignoreAntialiasing: false,
    padDimensionMismatch: false,
    updateBaseline: true,
  });
  assert.equal(failed.status, 'failed');
  assert.match(failed.message, /does not overwrite an approved baseline/);
  assert.equal(sha256(await readFile(baselinePath)), approvedHash);
});

test('approval archives the previous baseline and a later failure does not overwrite it', async () => {
  const { manager, id, config } = await createFixture();
  const original = createSolidPng(16, 16, blue);
  const reviewed = createSolidPng(16, 16, red);
  const first = await manager.approve(id, original, 'Ada Lovelace');
  assert.equal(first.version, 1);
  assert.equal(first.unchanged, false);

  const failed = await manager.compare({
    identity: id,
    actual: reviewed,
    threshold: 0,
    maxDiffPixelRatio: 0,
    maxDiffPixels: null,
    ignoreAntialiasing: false,
    padDimensionMismatch: false,
    updateBaseline: false,
  });
  assert.equal(failed.status, 'failed');
  const baselinePath = path.join(config.baselineDir, 'sample/card/chromium-desktop.png');
  assert.equal(sha256(await readFile(baselinePath)), sha256(original));

  const second = await manager.approve(id, reviewed, 'Grace Hopper');
  assert.equal(second.version, 2);
  assert.equal(second.approver, 'Grace Hopper');
  assert.equal(sha256(await readFile(baselinePath)), sha256(reviewed));
  assert.ok(second.archivedPath);
  const archivedFiles = await readdir(path.dirname(path.resolve(second.archivedPath)));
  assert.equal(archivedFiles.length, 1);

  const manifest = await manager.readManifest();
  const entry = manifest.baselines[second.key];
  assert.ok(entry);
  assert.equal(entry.approver, 'Grace Hopper');
  assert.equal(entry.sha256, sha256(reviewed));
  assert.equal(entry.version, 2);
  assert.equal(entry.width, 16);
  assert.match(entry.approvedAt, /^\d{4}-\d{2}-\d{2}T/);

  const same = await manager.approve(id, reviewed, 'Grace Hopper');
  assert.equal(same.unchanged, true);
  assert.equal(same.version, 2);

  const after = await manager.compare({
    identity: id,
    actual: original,
    threshold: 0,
    maxDiffPixelRatio: 0,
    maxDiffPixels: null,
    ignoreAntialiasing: false,
    padDimensionMismatch: false,
    updateBaseline: false,
  });
  assert.equal(after.status, 'failed');
  assert.equal(sha256(await readFile(baselinePath)), sha256(reviewed));
  await manager.verify();
});

test('verify reports a tampered baseline', async () => {
  const { manager, id, config } = await createFixture();
  await manager.approve(id, createSolidPng(8, 8, blue), 'Ada Lovelace');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(config.baselineDir, 'sample/card/chromium-desktop.png'), createSolidPng(8, 8, red));
  await assert.rejects(() => manager.verify(), /sha256/);
});

async function exists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}
