import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { selectedBrowsers } from '../../src/config/browsers';
import { loadConfig } from '../../src/config/load-config';
import type { CheckStatus, VisualCheckResult } from '../../src/model';
import { renderHtmlReport, writeHtmlReport } from '../../src/report/html-report';
import { loadResults } from '../../src/report/results-store';

test('the generated HTML report matches the recorded visual results', async () => {
  const config = loadConfig();
  const results = await loadResults(config.resultsDir);
  const expected = expectedStatuses();
  const actual = new Map(results.map((result) => [result.key, result.status]));
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [key, status] of expected) {
    expect(actual.get(key), key).toBe(status);
  }

  const metadata = {
    title: 'Visual Regression Report',
    generatedAt: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
    nodeVersion: process.version,
  };
  const file = await writeHtmlReport(results, metadata, config.reportDir);
  const html = await readFile(file, 'utf8');
  const rendered = renderHtmlReport(results, metadata);
  expect(html).toBe(rendered);

  const body = /<body([^>]*)>/.exec(html);
  expect(body?.[1]).toContain(`data-total="${results.length}"`);
  for (const [attribute, status] of [
    ['data-passed', 'passed'],
    ['data-failed', 'failed'],
    ['data-missing-baseline', 'missing-baseline'],
    ['data-dimension-mismatch', 'dimension-mismatch'],
    ['data-baseline-created', 'baseline-created'],
  ] as const) {
    const count = results.filter((result) => result.status === status).length;
    expect(body?.[1]).toContain(`${attribute}="${count}"`);
  }

  const island = /<script type="application\/json" id="vrt-results">([\s\S]*?)<\/script>/.exec(html);
  expect(island?.[1]).toBeTruthy();
  const parsed = JSON.parse(island?.[1] ?? '{}') as { checks: VisualCheckResult[] };
  expect(parsed.checks).toHaveLength(results.length);

  for (const result of results) {
    expect(html).toContain(`data-key="${result.key}"`);
    expect(html).toContain(`data-status="${result.status}"`);
    expect(html).toContain(`data-browser="${result.browser}"`);
    expect(html).toContain(`data-viewport="${result.viewport}"`);
    expect(html).toContain(`data-diff-ratio="${result.diffPixelRatio.toFixed(6)}"`);
    expect(html).toContain(result.label);
    if (result.diffExists) {
      const card = cardHtml(html, result.key);
      expect(card).toContain('data:image/png;base64,');
    }
  }
});

function expectedStatuses(): Map<string, CheckStatus> {
  const expected = new Map<string, CheckStatus>();
  const browsers = selectedBrowsers();
  if (browsers.includes('chromium')) {
    expected.set('dashboard/viewport/chromium-desktop', 'passed');
    expected.set('dashboard/pricing/chromium-desktop', 'passed');
    expected.set('dashboard/responsive/chromium-tablet', 'passed');
    expected.set('dashboard/responsive/chromium-mobile', 'passed');
    for (const variant of ['color', 'font', 'spacing', 'size', 'layout', 'missing']) {
      expected.set(`changes/${variant}/chromium-desktop`, 'failed');
    }
    expected.set('threshold/loose/chromium-desktop', 'passed');
    expected.set('threshold/strict/chromium-desktop', 'failed');
    expected.set('missing/not-approved/chromium-desktop', 'missing-baseline');
    expected.set('dimensions/mismatch/chromium-desktop', 'dimension-mismatch');
  }
  for (const browser of browsers) {
    expected.set(`dashboard/full-page/${browser}-desktop`, 'passed');
  }
  return expected;
}

function cardHtml(html: string, key: string): string {
  const token = `data-key="${key}"`;
  const start = html.indexOf(token);
  const next = html.indexOf('<article', start + token.length);
  return html.slice(start, next === -1 ? html.length : next);
}
