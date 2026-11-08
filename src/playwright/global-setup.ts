import { rm } from 'node:fs/promises';
import path from 'node:path';
import { BaselineManager } from '../baseline/manager';
import { loadConfig } from '../config/load-config';
import { VrtError } from '../errors';

export default async function globalSetup(): Promise<void> {
  const config = loadConfig();
  const protectedDirs = [config.baselineDir, config.historyDir];
  for (const dir of [config.actualDir, config.diffDir, config.pendingDir, config.resultsDir, config.reportDir]) {
    await resetOutput(dir, protectedDirs);
  }
  if (config.updateBaselines) {
    return;
  }
  const manager = new BaselineManager(config);
  await manager.verify();
}

async function resetOutput(dir: string, protectedDirs: readonly string[]): Promise<void> {
  const resolved = path.resolve(dir);
  const root = path.parse(resolved).root;
  if (resolved === path.resolve('.') || resolved === root) {
    throw new VrtError(`Refusing to clear "${dir}".`);
  }
  for (const protectedDir of protectedDirs) {
    const resolvedProtected = path.resolve(protectedDir);
    if (resolved === resolvedProtected || resolved.startsWith(`${resolvedProtected}${path.sep}`)) {
      throw new VrtError(`Refusing to clear "${dir}" because it overlaps "${protectedDir}".`);
    }
  }
  await rm(resolved, { recursive: true, force: true });
}
