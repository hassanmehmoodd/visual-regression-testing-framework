import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compareImages, type CompareOptions } from '../comparison/engine';
import { decodePng } from '../comparison/image';
import type { VrtConfig } from '../config/types';
import { VrtError } from '../errors';
import type { ApprovalReceipt, ScreenshotIdentity, VisualCheckResult } from '../model';
import { sha256 } from './hash';
import { withFileLock } from './lock';
import {
  appendHistory,
  readManifest,
  writeManifest,
  type BaselineManifest,
  type ManifestEntry,
} from './manifest';
import { screenshotFile, screenshotKey, toPosixRelative } from './paths';

export interface CompareRequest {
  identity: ScreenshotIdentity;
  baselineIdentity?: ScreenshotIdentity;
  actual: Buffer;
  threshold: number;
  maxDiffPixelRatio: number;
  maxDiffPixels: number | null;
  ignoreAntialiasing: boolean;
  padDimensionMismatch: boolean;
  updateBaseline: boolean;
  label?: string;
}

export class BaselineManager {
  private readonly manifestPath: string;

  private readonly historyLogPath: string;

  private readonly lockPath: string;

  constructor(private readonly config: VrtConfig) {
    this.manifestPath = path.join(config.baselineDir, 'manifest.json');
    this.historyLogPath = path.join(config.historyDir, 'log.jsonl');
    this.lockPath = path.join(config.baselineDir, '.vrt-lock');
  }

  async compare(request: CompareRequest): Promise<VisualCheckResult> {
    const identity = request.identity;
    const baselineIdentity = request.baselineIdentity ?? identity;
    const key = screenshotKey(identity, this.config.includePlatform);
    const baselineKey = screenshotKey(baselineIdentity, this.config.includePlatform);
    const actualPath = screenshotFile(this.config.actualDir, identity, this.config.includePlatform);
    const baselinePath = screenshotFile(this.config.baselineDir, baselineIdentity, this.config.includePlatform);
    const diffPath = screenshotFile(this.config.diffDir, identity, this.config.includePlatform);
    const pendingPath = screenshotFile(this.config.pendingDir, identity, this.config.includePlatform);
    const label = request.label ?? `${identity.suite} / ${identity.name}`;
    const actualImage = decodePng(request.actual);

    await mkdir(path.dirname(actualPath), { recursive: true });
    await writeFile(actualPath, request.actual);

    const options: CompareOptions = {
      threshold: request.threshold,
      maxDiffPixelRatio: request.maxDiffPixelRatio,
      maxDiffPixels: request.maxDiffPixels,
      ignoreAntialiasing: request.ignoreAntialiasing,
      padDimensionMismatch: request.padDimensionMismatch,
    };
    const completedAt = new Date().toISOString();
    const baselineExists = await fileExists(baselinePath);

    const skeleton = {
      key,
      baselineKey,
      suite: identity.suite,
      name: identity.name,
      label,
      browser: identity.browser,
      viewport: identity.viewport,
      threshold: request.threshold,
      maxDiffPixelRatio: request.maxDiffPixelRatio,
      maxDiffPixels: request.maxDiffPixels,
      ignoreAntialiasing: request.ignoreAntialiasing,
      actualWidth: actualImage.width,
      actualHeight: actualImage.height,
      actualExists: true,
      completedAt,
      paths: {
        baseline: toPosixRelative(baselinePath),
        actual: toPosixRelative(actualPath),
        diff: null,
        pending: null,
      },
    };

    if (!baselineExists) {
      await mkdir(path.dirname(pendingPath), { recursive: true });
      await writeFile(pendingPath, request.actual);
      if (request.updateBaseline) {
        await this.approve(baselineIdentity, request.actual, this.config.approver);
        return {
          ...skeleton,
          status: 'baseline-created',
          message:
            `Created baseline ${baselineKey} because update mode is on. ` +
            'Update mode does not overwrite a baseline that already exists.',
          diffPixels: 0,
          diffPixelRatio: 0,
          totalPixels: actualImage.width * actualImage.height,
          dimensionMismatch: false,
          padded: false,
          baselineWidth: actualImage.width,
          baselineHeight: actualImage.height,
          baselineExists: true,
          diffExists: false,
          paths: { ...skeleton.paths, pending: toPosixRelative(pendingPath) },
        };
      }

      return {
        ...skeleton,
        status: 'missing-baseline',
        message:
          `No approved baseline for ${baselineKey}. A pending candidate was saved at ${toPosixRelative(pendingPath)}. ` +
          `Review it and run: npm run baseline:approve -- --test ${baselineIdentity.suite}/${baselineIdentity.name} ` +
          `--browser ${baselineIdentity.browser} --viewport ${baselineIdentity.viewport}`,
        diffPixels: 0,
        diffPixelRatio: 0,
        totalPixels: actualImage.width * actualImage.height,
        dimensionMismatch: false,
        padded: false,
        baselineWidth: null,
        baselineHeight: null,
        baselineExists: false,
        diffExists: false,
        paths: { ...skeleton.paths, pending: toPosixRelative(pendingPath) },
      };
    }

    const baselinePng = await readFile(baselinePath);
    const baselineHashBefore = sha256(baselinePng);
    const comparison = await compareImages(baselinePng, request.actual, options);
    const baselineHashAfter = sha256(await readFile(baselinePath));
    if (baselineHashBefore !== baselineHashAfter) {
      throw new VrtError(`Comparison modified the approved baseline ${baselineKey}.`);
    }

    let diffExists = false;
    if (comparison.diffPng && comparison.status !== 'passed') {
      await mkdir(path.dirname(diffPath), { recursive: true });
      await writeFile(diffPath, comparison.diffPng);
      diffExists = true;
    }

    let message = comparison.message;
    if (request.updateBaseline && comparison.status !== 'passed') {
      message += ' Update mode does not overwrite an approved baseline.';
    }

    return {
      ...skeleton,
      status: comparison.status,
      message,
      diffPixels: comparison.diffPixels,
      diffPixelRatio: comparison.diffPixelRatio,
      totalPixels: comparison.totalPixels,
      dimensionMismatch: comparison.dimensionMismatch,
      padded: comparison.padded,
      baselineWidth: comparison.baselineWidth,
      baselineHeight: comparison.baselineHeight,
      baselineExists: true,
      diffExists,
      paths: {
        ...skeleton.paths,
        diff: diffExists ? toPosixRelative(diffPath) : null,
      },
    };
  }

  async approve(identity: ScreenshotIdentity, png: Buffer, approver: string): Promise<ApprovalReceipt> {
    const trimmed = approver.trim();
    if (trimmed.length === 0 || trimmed.length > 120 || /[\r\n]/.test(trimmed)) {
      throw new VrtError('approver must be 1 to 120 characters and must not contain line breaks.');
    }
    const image = decodePng(png);
    const key = screenshotKey(identity, this.config.includePlatform);
    const baselinePath = screenshotFile(this.config.baselineDir, identity, this.config.includePlatform);
    const nextHash = sha256(png);

    await mkdir(this.config.baselineDir, { recursive: true });
    return withFileLock(this.lockPath, async () => {
      const manifest = await readManifest(this.manifestPath);
      const current = manifest.baselines[key];
      const existed = await fileExists(baselinePath);
      let previousHash: string | null = null;
      if (existed) {
        const currentBytes = await readFile(baselinePath);
        previousHash = sha256(currentBytes);
        if (previousHash === nextHash) {
          return {
            key,
            version: current?.version ?? 1,
            sha256: nextHash,
            approver: current?.approver ?? trimmed,
            approvedAt: current?.approvedAt ?? new Date().toISOString(),
            baselinePath: toPosixRelative(baselinePath),
            archivedPath: null,
            unchanged: true,
          };
        }
      }

      const previousVersion = current?.version ?? (existed ? 1 : 0);
      const nextVersion = previousVersion + 1;
      let archivedPath: string | null = null;
      let archivedFile: string | null = null;
      if (existed && previousHash) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveName = `v${previousVersion}-${previousHash.slice(0, 12)}-${stamp}.png`;
        const absoluteArchive = path.join(
          this.config.historyDir,
          identity.suite,
          identity.name,
          screenshotLeafName(identity, this.config.includePlatform),
          archiveName,
        );
        await mkdir(path.dirname(absoluteArchive), { recursive: true });
        await copyFile(baselinePath, absoluteArchive);
        archivedPath = toPosixRelative(absoluteArchive);
        archivedFile = path.relative(this.config.historyDir, absoluteArchive).split(path.sep).join('/');
      }

      await mkdir(path.dirname(baselinePath), { recursive: true });
      const temporary = `${baselinePath}.${process.pid}.tmp`;
      await writeFile(temporary, png);
      await rename(temporary, baselinePath);

      const approvedAt = new Date().toISOString();
      const relativeFile = path.relative(this.config.baselineDir, baselinePath).split(path.sep).join('/');
      const entry: ManifestEntry = {
        key,
        file: relativeFile,
        sha256: nextHash,
        width: image.width,
        height: image.height,
        bytes: png.length,
        approvedAt,
        approver: trimmed,
        version: nextVersion,
        platform: process.platform,
      };
      manifest.baselines[key] = entry;
      await writeManifest(this.manifestPath, manifest);
      await appendHistory(this.historyLogPath, {
        action: 'approve',
        key,
        version: nextVersion,
        sha256: nextHash,
        previousSha256: previousHash,
        approver: trimmed,
        approvedAt,
        archivedFile,
      });

      return {
        key,
        version: nextVersion,
        sha256: nextHash,
        approver: trimmed,
        approvedAt,
        baselinePath: toPosixRelative(baselinePath),
        archivedPath,
        unchanged: false,
      };
    });
  }

  async readManifest(): Promise<BaselineManifest> {
    return readManifest(this.manifestPath);
  }

  async verify(): Promise<void> {
    const manifest = await readManifest(this.manifestPath);
    const errors: string[] = [];
    const listed = new Set<string>();

    for (const [key, entry] of Object.entries(manifest.baselines)) {
      if (entry.key !== key) {
        errors.push(`${key}: entry key is ${entry.key}`);
      }
      listed.add(entry.file);
      const absolute = path.join(this.config.baselineDir, entry.file);
      if (!(await fileExists(absolute))) {
        errors.push(`${key}: missing file ${entry.file}`);
        continue;
      }
      const bytes = await readFile(absolute);
      const hash = sha256(bytes);
      if (hash !== entry.sha256) {
        errors.push(`${key}: sha256 is ${hash}, manifest has ${entry.sha256}`);
      }
      const image = decodePng(bytes);
      if (image.width !== entry.width || image.height !== entry.height) {
        errors.push(
          `${key}: dimensions are ${image.width}x${image.height}, manifest has ${entry.width}x${entry.height}`,
        );
      }
    }

    const historyRoot = path.resolve(this.config.historyDir);
    let pngs: string[] = [];
    if (await fileExists(this.config.baselineDir)) {
      pngs = await listPngs(this.config.baselineDir, historyRoot);
    }
    for (const relative of pngs) {
      if (!listed.has(relative)) {
        errors.push(`orphan baseline file ${relative} is not in the manifest`);
      }
    }

    if (errors.length > 0) {
      throw new VrtError(`Baseline verification failed:\n${errors.join('\n')}`);
    }
  }
}

function screenshotLeafName(identity: ScreenshotIdentity, includePlatform: boolean): string {
  return screenshotKey(identity, includePlatform).split('/').at(-1) ?? identity.browser;
}

async function listPngs(root: string, historyRoot: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    const resolved = path.resolve(current);
    if (resolved === historyRoot || resolved.startsWith(`${historyRoot}${path.sep}`)) {
      return;
    }
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith('.png')) {
        files.push(path.relative(root, absolute).split(path.sep).join('/'));
      }
    }
  }

  await walk(root);
  return files.sort();
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
