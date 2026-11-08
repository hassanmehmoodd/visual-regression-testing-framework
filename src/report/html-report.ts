import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CheckStatus, VisualCheckResult } from '../model';

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  missingBaseline: number;
  dimensionMismatch: number;
  baselineCreated: number;
}

export interface ReportMetadata {
  title: string;
  generatedAt: string;
  platform: string;
  nodeVersion: string;
}

const STATUS_RANK: Record<CheckStatus, number> = {
  failed: 0,
  'dimension-mismatch': 1,
  'missing-baseline': 2,
  'baseline-created': 3,
  passed: 4,
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  'missing-baseline': 'Missing baseline',
  'dimension-mismatch': 'Dimension mismatch',
  'baseline-created': 'Baseline created',
};

export function summarize(results: readonly VisualCheckResult[]): ReportSummary {
  const summary: ReportSummary = {
    total: results.length,
    passed: 0,
    failed: 0,
    missingBaseline: 0,
    dimensionMismatch: 0,
    baselineCreated: 0,
  };
  for (const result of results) {
    switch (result.status) {
      case 'passed':
        summary.passed += 1;
        break;
      case 'failed':
        summary.failed += 1;
        break;
      case 'missing-baseline':
        summary.missingBaseline += 1;
        break;
      case 'dimension-mismatch':
        summary.dimensionMismatch += 1;
        break;
      case 'baseline-created':
        summary.baselineCreated += 1;
        break;
      default: {
        const unexpected: never = result.status;
        throw new Error(`Unknown status ${String(unexpected)}`);
      }
    }
  }
  return summary;
}

export function renderHtmlReport(results: readonly VisualCheckResult[], metadata: ReportMetadata): string {
  const ordered = [...results].sort((left, right) => {
    const byStatus = STATUS_RANK[left.status] - STATUS_RANK[right.status];
    if (byStatus !== 0) {
      return byStatus;
    }
    return left.key.localeCompare(right.key);
  });
  const summary = summarize(ordered);
  const payload = {
    summary,
    metadata,
    checks: ordered,
  };
  const json = JSON.stringify(payload).replaceAll('<', '\\u003c');

  const cards = ordered.map((result) => renderCheck(result)).join('\n');
  const empty = ordered.length === 0 ? '<p class="empty">No visual checks were recorded.</p>' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f5f9;
      --ink: #172033;
      --muted: #5d6b82;
      --line: #d9e1ee;
      --card: #ffffff;
      --accent: #2f5bff;
      --passed: #0e8f6e;
      --passed-bg: #e7f7f1;
      --failed: #c4324a;
      --failed-bg: #fdecef;
      --missing: #9a6700;
      --missing-bg: #fff6e0;
      --dimension: #1d4ed8;
      --dimension-bg: #e8efff;
      --created: #6d28d9;
      --created-bg: #f3e8ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
    }
    header.top {
      padding: 28px 32px 20px;
      background: #101828;
      color: #f8fafc;
    }
    header.top h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.03em; }
    header.top p { margin: 0; color: #c5d0e0; }
    main { padding: 24px 32px 64px; max-width: 1280px; margin: 0 auto; }
    .summary {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .tile {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px 16px;
    }
    .tile span { display: block; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .tile strong { display: block; margin-top: 6px; font-size: 28px; letter-spacing: -0.04em; }
    .toolbar { display: flex; gap: 12px; align-items: center; margin: 8px 0 18px; flex-wrap: wrap; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .filters button, #search {
      border: 1px solid var(--line);
      background: white;
      color: var(--ink);
      border-radius: 999px;
      padding: 8px 12px;
      font: inherit;
    }
    .filters button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: white; }
    #search { min-width: min(420px, 100%); border-radius: 12px; }
    .check {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .check-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .check h2 { margin: 0 0 4px; font-size: 18px; }
    .meta { color: var(--muted); font-size: 13px; }
    .badge {
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .badge.passed { color: var(--passed); background: var(--passed-bg); }
    .badge.failed { color: var(--failed); background: var(--failed-bg); }
    .badge.missing-baseline { color: var(--missing); background: var(--missing-bg); }
    .badge.dimension-mismatch { color: var(--dimension); background: var(--dimension-bg); }
    .badge.baseline-created { color: var(--created); background: var(--created-bg); }
    .message { margin: 12px 0; line-height: 1.45; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; color: var(--muted); font-size: 13px; margin-bottom: 12px; }
    .images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    figure { margin: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #f8fafc; }
    figcaption { padding: 8px 10px; font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--line); }
    img { display: block; width: 100%; height: auto; background: white; }
    .placeholder { padding: 28px 12px; color: var(--muted); text-align: center; }
    .empty { padding: 24px; background: white; border-radius: 12px; }
    @media (max-width: 900px) {
      .summary, .images { grid-template-columns: 1fr; }
      main, header.top { padding-left: 16px; padding-right: 16px; }
    }
  </style>
</head>
<body
  data-total="${summary.total}"
  data-passed="${summary.passed}"
  data-failed="${summary.failed}"
  data-missing-baseline="${summary.missingBaseline}"
  data-dimension-mismatch="${summary.dimensionMismatch}"
  data-baseline-created="${summary.baselineCreated}"
>
  <header class="top">
    <h1>${escapeHtml(metadata.title)}</h1>
    <p>Generated ${escapeHtml(metadata.generatedAt)} · ${escapeHtml(metadata.platform)} · Node ${escapeHtml(metadata.nodeVersion)}</p>
  </header>
  <main>
    <section class="summary" id="summary">
      ${tile('Total', summary.total)}
      ${tile('Passed', summary.passed)}
      ${tile('Failed', summary.failed)}
      ${tile('Missing baseline', summary.missingBaseline)}
      ${tile('Dimension mismatch', summary.dimensionMismatch)}
      ${tile('Baseline created', summary.baselineCreated)}
    </section>
    <div class="toolbar">
      <div class="filters">
        <button type="button" data-filter="all" aria-pressed="true">All</button>
        <button type="button" data-filter="failed" aria-pressed="false">Failed</button>
        <button type="button" data-filter="passed" aria-pressed="false">Passed</button>
        <button type="button" data-filter="missing-baseline" aria-pressed="false">Missing baseline</button>
        <button type="button" data-filter="dimension-mismatch" aria-pressed="false">Dimension mismatch</button>
        <button type="button" data-filter="baseline-created" aria-pressed="false">Baseline created</button>
      </div>
      <input id="search" type="search" placeholder="Filter by name, browser, or viewport" aria-label="Filter checks">
    </div>
    ${empty}
    ${cards}
  </main>
  <script type="application/json" id="vrt-results">${json}</script>
  <script>
    const buttons = Array.from(document.querySelectorAll('[data-filter]'));
    const search = document.querySelector('#search');
    const checks = Array.from(document.querySelectorAll('article.check'));
    let statusFilter = 'all';
    let query = '';
    function applyFilter() {
      for (const check of checks) {
        const status = check.getAttribute('data-status') || '';
        const haystack = check.getAttribute('data-search') || '';
        const visible = (statusFilter === 'all' || status === statusFilter) && haystack.includes(query);
        check.hidden = !visible;
      }
    }
    for (const button of buttons) {
      button.addEventListener('click', () => {
        statusFilter = button.getAttribute('data-filter') || 'all';
        for (const candidate of buttons) candidate.setAttribute('aria-pressed', String(candidate === button));
        applyFilter();
      });
    }
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      applyFilter();
    });
  </script>
</body>
</html>
`;
}

export async function writeHtmlReport(
  results: readonly VisualCheckResult[],
  metadata: ReportMetadata,
  reportDir: string,
): Promise<string> {
  const html = renderHtmlReport(results, metadata);
  await mkdir(reportDir, { recursive: true });
  const file = path.join(reportDir, 'index.html');
  await writeFile(file, html);
  return file;
}

function renderCheck(result: VisualCheckResult): string {
  const search = [result.label, result.key, result.browser, result.viewport, result.status, result.suite, result.name]
    .join(' ')
    .toLowerCase();
  const size = result.baselineWidth === null
    ? `actual ${formatSize(result.actualWidth, result.actualHeight)}`
    : `baseline ${formatSize(result.baselineWidth, result.baselineHeight)} · actual ${formatSize(result.actualWidth, result.actualHeight)}`;
  return `<article class="check" data-key="${escapeHtml(result.key)}" data-status="${escapeHtml(result.status)}" data-browser="${escapeHtml(result.browser)}" data-viewport="${escapeHtml(result.viewport)}" data-diff-ratio="${result.diffPixelRatio.toFixed(6)}" data-diff-pixels="${result.diffPixels}" data-threshold="${result.threshold}" data-max-diff-ratio="${result.maxDiffPixelRatio.toFixed(6)}" data-search="${escapeHtml(search)}">
  <div class="check-head">
    <div>
      <h2>${escapeHtml(result.label)}</h2>
      <div class="meta">${escapeHtml(result.key)}</div>
    </div>
    <span class="badge ${escapeHtml(result.status)}">${escapeHtml(STATUS_LABEL[result.status])}</span>
  </div>
  <p class="message">${escapeHtml(result.message)}</p>
  <div class="stats">
    <span>Diff ${(result.diffPixelRatio * 100).toFixed(4)}% (${result.diffPixels} px)</span>
    <span>Per-pixel threshold ${result.threshold}</span>
    <span>Max ratio ${(result.maxDiffPixelRatio * 100).toFixed(4)}%</span>
    <span>Max pixels ${result.maxDiffPixels === null ? 'not set' : result.maxDiffPixels}</span>
    <span>${result.ignoreAntialiasing ? 'Anti-aliasing ignored' : 'Anti-aliasing counted'}</span>
    <span>${escapeHtml(size)}</span>
  </div>
  <div class="images">
    ${figure('Baseline', result.paths.baseline, result.baselineExists)}
    ${figure('Actual', result.paths.actual, result.actualExists)}
    ${figure('Diff', result.paths.diff, result.diffExists)}
  </div>
</article>`;
}

function figure(label: string, file: string | null, exists: boolean): string {
  if (!file || !exists) {
    return `<figure><figcaption>${escapeHtml(label)}</figcaption><div class="placeholder">Not available</div></figure>`;
  }
  const absolute = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  let source = '';
  try {
    const bytes = readFileSync(absolute);
    source = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    return `<figure><figcaption>${escapeHtml(label)}</figcaption><div class="placeholder">Could not read ${escapeHtml(file)}</div></figure>`;
  }
  return `<figure><figcaption>${escapeHtml(label)}</figcaption><img alt="${escapeHtml(label)} for ${escapeHtml(file)}" src="${source}"></figure>`;
}

function tile(label: string, value: number): string {
  return `<div class="tile"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function formatSize(width: number | null, height: number | null): string {
  if (width === null || height === null) {
    return 'unknown';
  }
  return `${width}×${height}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
