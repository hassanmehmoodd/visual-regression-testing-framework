import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const reportSource = path.join(root, 'test-results/visual/report/index.html');
const reportTarget = path.join(root, 'docs/examples/report.html');
const diffDir = path.join(root, 'docs/examples/diffs');

const copies: Array<[string, string]> = [
  ['baselines/dashboard/full-page/chromium-desktop.png', 'color-baseline.png'],
  ['test-results/visual/actual/changes/color/chromium-desktop.png', 'color-actual.png'],
  ['test-results/visual/diff/changes/color/chromium-desktop.png', 'color-diff.png'],
  ['test-results/visual/diff/changes/font/chromium-desktop.png', 'font-diff.png'],
  ['test-results/visual/diff/changes/layout/chromium-desktop.png', 'layout-diff.png'],
  ['test-results/visual/diff/changes/missing/chromium-desktop.png', 'missing-diff.png'],
  ['test-results/visual/diff/changes/spacing/chromium-desktop.png', 'spacing-diff.png'],
  ['test-results/visual/diff/changes/size/chromium-desktop.png', 'size-diff.png'],
];

await mkdir(diffDir, { recursive: true });
await mkdir(path.join(root, 'docs/images'), { recursive: true });
await copyFile(reportSource, reportTarget);
for (const [source, name] of copies) {
  await copyFile(path.join(root, source), path.join(diffDir, name));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(reportTarget).href);
await page.locator('#summary').waitFor();
await page.screenshot({ path: path.join(root, 'docs/images/report-summary.png') });
await page.addStyleTag({
  content: 'article.check img { max-height: 180px; object-fit: cover; object-position: top; }',
});
const failed = page.locator('article.check[data-status="failed"]').first();
await failed.scrollIntoViewIfNeeded();
await failed.screenshot({ path: path.join(root, 'docs/images/report-failure.png') });
await browser.close();

const html = await readFile(reportTarget, 'utf8');
const total = /data-total="(\d+)"/.exec(html)?.[1] ?? 'unknown';
console.log(`Exported report (${total} checks) and ${copies.length} example images.`);
