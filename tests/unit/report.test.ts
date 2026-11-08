import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSolidPng } from '../../src/comparison/image';
import { renderHtmlReport, summarize } from '../../src/report/html-report';
import { loadResults, recordResult } from '../../src/report/results-store';
import { resolveConfig } from '../../src/config/resolve';
import { sampleResult } from '../helpers/result';

test('the html report escapes text, embeds images, and exposes summary data', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vrt-report-'));
  const actual = path.join(root, 'actual.png');
  const diff = path.join(root, 'diff.png');
  await writeFile(actual, createSolidPng(4, 4, [0, 0, 0, 255]));
  await writeFile(diff, createSolidPng(4, 4, [255, 0, 0, 255]));
  const hostile = sampleResult({
    key: 'changes/color/chromium-desktop',
    label: '</script><img src=x onerror=alert(1)>',
    status: 'failed',
    message: 'Pixel diff <exceeded> & "threshold"',
    diffPixels: 12,
    diffPixelRatio: 0.125,
    paths: { baseline: path.join(root, 'missing.png'), actual, diff, pending: null },
    baselineExists: false,
    actualExists: true,
    diffExists: true,
    completedAt: '2026-11-08T01:00:00.000Z',
  });
  const passed = sampleResult({ completedAt: '2026-11-08T02:00:00.000Z' });
  const html = renderHtmlReport([passed, hostile], {
    title: 'Visual Regression Report',
    generatedAt: '2026-11-08T03:00:00.000Z',
    platform: 'linux x64',
    nodeVersion: '22.23.4',
  });

  assert.match(html, /data-total="2"/);
  assert.match(html, /data-passed="1"/);
  assert.match(html, /data-failed="1"/);
  assert.match(html, /&lt;\/script&gt;&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /Pixel diff &lt;exceeded&gt; &amp; &quot;threshold&quot;/);
  assert.equal(html.includes('<h2></script>'), false);
  assert.match(html, /data:image\/png;base64,/);
  const island = html.match(/<script type="application\/json" id="vrt-results">([\s\S]*?)<\/script>/);
  assert.ok(island?.[1]);
  const parsed = JSON.parse(island[1]) as { summary: { failed: number }; checks: { key: string }[] };
  assert.equal(parsed.summary.failed, 1);
  assert.deepEqual(parsed.checks.map((check) => check.key).sort(), [
    'changes/color/chromium-desktop',
    'dashboard/full-page/chromium-desktop',
  ]);
  assert.deepEqual(summarize([passed, hostile]), {
    total: 2,
    passed: 1,
    failed: 1,
    missingBaseline: 0,
    dimensionMismatch: 0,
    baselineCreated: 0,
  });
});

test('result loading keeps the latest attempt for each key', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'vrt-results-'));
  const config = resolveConfig({ resultsDir: root });
  await recordResult(config, sampleResult({ status: 'failed', completedAt: '2026-11-08T01:00:00.000Z' }));
  await recordResult(config, sampleResult({ status: 'passed', completedAt: '2026-11-08T02:00:00.000Z' }));
  const loaded = await loadResults(root);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0]?.status, 'passed');
});
