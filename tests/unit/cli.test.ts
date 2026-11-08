import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { BaselineManager } from '../../src/baseline/manager';
import { sha256 } from '../../src/baseline/hash';
import { createSolidPng } from '../../src/comparison/image';
import { resolveConfig } from '../../src/config/resolve';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the approve CLI promotes a reviewed actual and leaves it untouched on failure', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vrt-cli-'));
  const dirs = {
    VRT_BASELINE_DIR: path.join(root, 'baselines'),
    VRT_ACTUAL_DIR: path.join(root, 'actual'),
    VRT_DIFF_DIR: path.join(root, 'diff'),
    VRT_PENDING_DIR: path.join(root, 'pending'),
    VRT_REPORT_DIR: path.join(root, 'report'),
    VRT_RESULTS_DIR: path.join(root, 'results'),
    VRT_HISTORY_DIR: path.join(root, 'history'),
    VRT_UPDATE_BASELINES: '0',
    VRT_APPROVER: 'Should Not Be Used',
  };
  const config = resolveConfig({}, dirs);
  const manager = new BaselineManager(config);
  const id = { suite: 'sample', name: 'card', browser: 'chromium', viewport: 'desktop' };
  const original = createSolidPng(10, 10, [1, 2, 3, 255]);
  const reviewed = createSolidPng(10, 10, [9, 8, 7, 255]);
  await manager.approve(id, original, 'Initial');

  const actualPath = path.join(dirs.VRT_ACTUAL_DIR, 'sample/card/chromium-desktop.png');
  await writeFile(actualPath, reviewed).catch(async (error: unknown) => {
    const { mkdir } = await import('node:fs/promises');
    if (isMissing(error)) {
      await mkdir(path.dirname(actualPath), { recursive: true });
      await writeFile(actualPath, reviewed);
      return;
    }
    throw error;
  });

  const missing = runApprove(['--test', 'sample/card', '--browser', 'firefox', '--viewport', 'desktop'], dirs);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Could not read/);

  const approved = runApprove(
    ['--test', 'sample/card', '--browser', 'chromium', '--viewport', 'desktop', '--approver', 'Grace Hopper'],
    dirs,
  );
  assert.equal(approved.status, 0, approved.stderr);
  const baselinePath = path.join(dirs.VRT_BASELINE_DIR, 'sample/card/chromium-desktop.png');
  assert.equal(sha256(await readFile(baselinePath)), sha256(reviewed));
  const manifest = JSON.parse(await readFile(path.join(dirs.VRT_BASELINE_DIR, 'manifest.json'), 'utf8')) as {
    baselines: Record<string, { approver: string; version: number }>;
  };
  assert.equal(manifest.baselines['sample/card/chromium-desktop']?.approver, 'Grace Hopper');
  assert.equal(manifest.baselines['sample/card/chromium-desktop']?.version, 2);

  const compared = await manager.compare({
    identity: id,
    actual: original,
    threshold: 0,
    maxDiffPixelRatio: 0,
    maxDiffPixels: null,
    ignoreAntialiasing: false,
    padDimensionMismatch: false,
    updateBaseline: false,
  });
  assert.equal(compared.status, 'failed');
  assert.equal(sha256(await readFile(baselinePath)), sha256(reviewed));
});

function runApprove(args: string[], env: Record<string, string>): { status: number | null; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', path.join(repoRoot, 'src/cli/approve.ts'), ...args],
    {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    },
  );
  return { status: result.status, stderr: result.stderr };
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
