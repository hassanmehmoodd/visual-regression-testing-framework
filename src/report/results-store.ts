import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { VrtConfig } from '../config/types';
import { VrtError } from '../errors';
import { CHECK_STATUSES, type CheckStatus, type VisualCheckResult } from '../model';

export async function recordResult(config: VrtConfig, result: VisualCheckResult): Promise<void> {
  await mkdir(config.resultsDir, { recursive: true });
  const stamp = result.completedAt.replace(/[:.]/g, '-');
  const file = path.join(
    config.resultsDir,
    `${result.key.replaceAll('/', '__')}__${stamp}__${randomUUID()}.json`,
  );
  await writeFile(file, `${JSON.stringify(result, null, 2)}\n`);
}

export async function loadResults(resultsDir: string): Promise<VisualCheckResult[]> {
  let files: string[] = [];
  try {
    files = await readdir(resultsDir);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const parsed: VisualCheckResult[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const absolute = path.join(resultsDir, file);
    const raw = await readFile(absolute, 'utf8');
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new VrtError(`Could not parse result file ${file}: ${message}`);
    }
    if (!isVisualCheckResult(value)) {
      throw new VrtError(`Result file ${file} is missing required fields.`);
    }
    parsed.push(value);
  }

  const newest = new Map<string, VisualCheckResult>();
  for (const result of parsed.sort((left, right) => left.completedAt.localeCompare(right.completedAt))) {
    newest.set(result.key, result);
  }
  return [...newest.values()];
}

function isVisualCheckResult(value: unknown): value is VisualCheckResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { key?: unknown; status?: unknown; message?: unknown };
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'string' &&
    (CHECK_STATUSES as readonly string[]).includes(candidate.status)
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function isCheckStatus(value: string): value is CheckStatus {
  return (CHECK_STATUSES as readonly string[]).includes(value);
}
