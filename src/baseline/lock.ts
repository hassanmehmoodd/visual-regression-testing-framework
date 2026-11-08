import { open, stat, unlink } from 'node:fs/promises';
import { VrtError } from '../errors';

const STALE_MS = 30_000;

export async function withFileLock<T>(lockPath: string, action: () => Promise<T>): Promise<T> {
  const started = Date.now();
  while (true) {
    try {
      const handle = await open(lockPath, 'wx');
      try {
        return await action();
      } finally {
        await handle.close();
        await unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') {
        throw error;
      }
      const info = await stat(lockPath).catch(() => undefined);
      if (info && Date.now() - info.mtimeMs > STALE_MS) {
        await unlink(lockPath).catch(() => undefined);
        continue;
      }
      if (Date.now() - started > 15_000) {
        throw new VrtError(`Timed out waiting for baseline lock ${lockPath}.`);
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
