import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { VrtError } from '../errors';

export interface ManifestEntry {
  key: string;
  file: string;
  sha256: string;
  width: number;
  height: number;
  bytes: number;
  approvedAt: string;
  approver: string;
  version: number;
  platform: string;
}

export interface BaselineManifest {
  version: 1;
  baselines: Record<string, ManifestEntry>;
}

export interface HistoryEvent {
  action: 'approve';
  key: string;
  version: number;
  sha256: string;
  previousSha256: string | null;
  approver: string;
  approvedAt: string;
  archivedFile: string | null;
}

export function emptyManifest(): BaselineManifest {
  return { version: 1, baselines: {} };
}

export async function readManifest(file: string): Promise<BaselineManifest> {
  try {
    const raw = await readFile(file, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isManifest(parsed)) {
      throw new VrtError(`Baseline manifest at ${file} is not a version 1 manifest.`);
    }
    return parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return emptyManifest();
    }
    throw error;
  }
}

export async function writeManifest(file: string, manifest: BaselineManifest): Promise<void> {
  const ordered: BaselineManifest = {
    version: 1,
    baselines: Object.fromEntries(
      Object.entries(manifest.baselines).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(ordered, null, 2)}\n`);
  await rename(temporary, file);
}

export async function appendHistory(file: string, event: HistoryEvent): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(event)}\n`, { flag: 'a' });
}

function isManifest(value: unknown): value is BaselineManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { version?: unknown; baselines?: unknown };
  return candidate.version === 1 && typeof candidate.baselines === 'object' && candidate.baselines !== null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
