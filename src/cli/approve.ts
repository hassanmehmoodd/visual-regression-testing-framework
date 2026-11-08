import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { screenshotFile } from '../baseline/paths';
import { BaselineManager } from '../baseline/manager';
import { loadConfig } from '../config/load-config';
import { VrtError } from '../errors';
import type { ScreenshotIdentity } from '../model';
import { parseArgs, readOption } from './args';

function printHelp(): void {
  console.log(`Approve a reviewed screenshot and promote it to the baseline.

Usage:
  npm run baseline:approve -- --test <suite/name> --browser <browser> --viewport <viewport> [--approver <name>] [--source actual|pending|<file>]
  npm run baseline:approve -- --list

An approved baseline is replaced only by this command. A failing comparison never overwrites it.
The previous file is copied into the history directory and the manifest records the hash, timestamp, and approver.
`);
}

function parseTestId(value: string): { suite: string; name: string } {
  const parts = value.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new VrtError(`--test must look like suite/name. Received "${value}".`);
  }
  return { suite: parts[0], name: parts[1] };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.has('help') || args.has('h')) {
    printHelp();
    return;
  }

  const config = loadConfig();
  const manager = new BaselineManager(config);

  if (args.has('list')) {
    const manifest = await manager.readManifest();
    const entries = Object.values(manifest.baselines).sort((left, right) => left.key.localeCompare(right.key));
    if (entries.length === 0) {
      console.log('No approved baselines.');
      return;
    }
    for (const entry of entries) {
      console.log(
        `${entry.key}  v${entry.version}  ${entry.width}x${entry.height}  ${entry.sha256.slice(0, 12)}  ${entry.approver}  ${entry.approvedAt}`,
      );
    }
    return;
  }

  const testId = readOption(args, 'test');
  const browser = readOption(args, 'browser');
  const viewport = readOption(args, 'viewport');
  if (!testId || !browser || !viewport) {
    printHelp();
    throw new VrtError('Missing --test, --browser, or --viewport.');
  }

  const parsed = parseTestId(testId);
  const identity: ScreenshotIdentity = { suite: parsed.suite, name: parsed.name, browser, viewport };
  const source = readOption(args, 'source') ?? 'actual';
  const approver = readOption(args, 'approver') ?? config.approver;
  const sourcePath = resolveSource(configDirs(config), identity, source, config.includePlatform);
  const png = await readFile(sourcePath).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new VrtError(`Could not read the screenshot to approve (${sourcePath}): ${message}`);
  });
  const receipt = await manager.approve(identity, png, approver);
  if (receipt.unchanged) {
    console.log(`Baseline ${receipt.key} already matches the reviewed screenshot (version ${receipt.version}).`);
    return;
  }
  console.log(`Approved ${receipt.key} version ${receipt.version} by ${receipt.approver} at ${receipt.approvedAt}.`);
  console.log(`Baseline: ${receipt.baselinePath}`);
  if (receipt.archivedPath) {
    console.log(`Archived previous baseline: ${receipt.archivedPath}`);
  }
}

function configDirs(config: Awaited<ReturnType<typeof loadConfig>>): {
  actualDir: string;
  pendingDir: string;
  includePlatform: boolean;
} {
  return {
    actualDir: config.actualDir,
    pendingDir: config.pendingDir,
    includePlatform: config.includePlatform,
  };
}

function resolveSource(
  dirs: { actualDir: string; pendingDir: string; includePlatform: boolean },
  identity: ScreenshotIdentity,
  source: string,
  includePlatform: boolean,
): string {
  if (source === 'actual') {
    return screenshotFile(dirs.actualDir, identity, includePlatform);
  }
  if (source === 'pending') {
    return screenshotFile(dirs.pendingDir, identity, includePlatform);
  }
  return path.resolve(source);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
