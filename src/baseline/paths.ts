import path from 'node:path';
import { VrtError } from '../errors';
import type { ScreenshotIdentity } from '../model';

const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;

export function assertSegment(label: string, value: string): string {
  if (!SEGMENT.test(value)) {
    throw new VrtError(
      `${label} must start with a letter or digit and contain only letters, digits, hyphens, and underscores. Received "${value}".`,
    );
  }
  return value;
}

export function screenshotLeaf(
  identity: ScreenshotIdentity,
  includePlatform: boolean,
  platform: string = process.platform,
): string {
  const browser = assertSegment('browser', identity.browser);
  const viewport = assertSegment('viewport', identity.viewport);
  if (!includePlatform) {
    return `${browser}-${viewport}`;
  }
  return `${browser}-${viewport}-${assertSegment('platform', platform)}`;
}

export function screenshotKey(
  identity: ScreenshotIdentity,
  includePlatform: boolean,
  platform: string = process.platform,
): string {
  const suite = assertSegment('suite', identity.suite);
  const name = assertSegment('name', identity.name);
  return `${suite}/${name}/${screenshotLeaf(identity, includePlatform, platform)}`;
}

export function screenshotFile(
  root: string,
  identity: ScreenshotIdentity,
  includePlatform: boolean,
  platform: string = process.platform,
): string {
  const suite = assertSegment('suite', identity.suite);
  const name = assertSegment('name', identity.name);
  return path.join(root, suite, name, `${screenshotLeaf(identity, includePlatform, platform)}.png`);
}

export function toPosixRelative(file: string, cwd: string = process.cwd()): string {
  const relative = path.relative(cwd, file);
  const normalized = (relative.length === 0 ? file : relative).split(path.sep).join('/');
  return normalized;
}
