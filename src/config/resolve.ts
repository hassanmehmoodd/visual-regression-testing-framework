import { VrtError } from '../errors';
import { defaultConfig } from './defaults';
import type { UserConfig, Viewport, VrtConfig } from './types';

const VIEWPORT_NAMES = ['desktop', 'tablet', 'mobile'] as const;

function readBoolean(name: string, value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  throw new VrtError(`${name} must be a boolean. Received "${value}".`);
}

function readNumber(name: string, value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new VrtError(`${name} must be a finite number. Received "${value}".`);
  }
  return parsed;
}

function readViewport(name: string, value: string | undefined): Viewport | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (!match) {
    throw new VrtError(`${name} must look like 1280x800. Received "${value}".`);
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  return { width, height };
}

function pick<T>(envValue: T | undefined, userValue: T | undefined, fallback: T): T {
  if (envValue !== undefined) {
    return envValue;
  }
  if (userValue !== undefined) {
    return userValue;
  }
  return fallback;
}

function assertRange(name: string, value: number, min: number, max: number): void {
  if (value < min || value > max) {
    throw new VrtError(`${name} must be between ${min} and ${max}. Received ${value}.`);
  }
}

function assertViewport(name: string, viewport: Viewport): void {
  if (!Number.isInteger(viewport.width) || viewport.width < 1 || viewport.width > 8000) {
    throw new VrtError(`${name} width must be an integer from 1 to 8000.`);
  }
  if (!Number.isInteger(viewport.height) || viewport.height < 1 || viewport.height > 8000) {
    throw new VrtError(`${name} height must be an integer from 1 to 8000.`);
  }
}

export function resolveConfig(user: UserConfig = {}, env: NodeJS.ProcessEnv = process.env): VrtConfig {
  const viewports: Record<string, Viewport> = { ...defaultConfig.viewports, ...user.viewports };
  for (const name of VIEWPORT_NAMES) {
    const override = readViewport(`VRT_VIEWPORT_${name.toUpperCase()}`, env[`VRT_VIEWPORT_${name.toUpperCase()}`]);
    if (override) {
      viewports[name] = override;
    }
  }
  for (const [name, viewport] of Object.entries(viewports)) {
    assertViewport(name, viewport);
  }

  const masksFromEnv = env.VRT_MASKS?.split(',')
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0);

  const maxDiffPixels = pick(
    readNumber('VRT_MAX_DIFF_PIXELS', env.VRT_MAX_DIFF_PIXELS),
    user.maxDiffPixels === undefined ? undefined : user.maxDiffPixels,
    defaultConfig.maxDiffPixels,
  );
  if (maxDiffPixels !== null && (!Number.isInteger(maxDiffPixels) || maxDiffPixels < 0)) {
    throw new VrtError('maxDiffPixels must be a non-negative integer or null.');
  }

  const threshold = pick(readNumber('VRT_THRESHOLD', env.VRT_THRESHOLD), user.threshold, defaultConfig.threshold);
  const maxDiffPixelRatio = pick(
    readNumber('VRT_MAX_DIFF_RATIO', env.VRT_MAX_DIFF_RATIO),
    user.maxDiffPixelRatio,
    defaultConfig.maxDiffPixelRatio,
  );
  assertRange('threshold', threshold, 0, 1);
  assertRange('maxDiffPixelRatio', maxDiffPixelRatio, 0, 1);

  const approver = pick(env.VRT_APPROVER?.trim(), user.approver?.trim(), defaultConfig.approver);
  if (approver.length === 0 || approver.length > 120 || /[\r\n]/.test(approver)) {
    throw new VrtError('approver must be 1 to 120 characters and must not contain line breaks.');
  }

  const config: VrtConfig = {
    baselineDir: pick(env.VRT_BASELINE_DIR, user.baselineDir, defaultConfig.baselineDir),
    actualDir: pick(env.VRT_ACTUAL_DIR, user.actualDir, defaultConfig.actualDir),
    diffDir: pick(env.VRT_DIFF_DIR, user.diffDir, defaultConfig.diffDir),
    pendingDir: pick(env.VRT_PENDING_DIR, user.pendingDir, defaultConfig.pendingDir),
    reportDir: pick(env.VRT_REPORT_DIR, user.reportDir, defaultConfig.reportDir),
    resultsDir: pick(env.VRT_RESULTS_DIR, user.resultsDir, defaultConfig.resultsDir),
    historyDir: pick(env.VRT_HISTORY_DIR, user.historyDir, defaultConfig.historyDir),
    threshold,
    maxDiffPixelRatio,
    maxDiffPixels,
    ignoreAntialiasing: pick(
      readBoolean('VRT_IGNORE_ANTIALIASING', env.VRT_IGNORE_ANTIALIASING),
      user.ignoreAntialiasing,
      defaultConfig.ignoreAntialiasing,
    ),
    updateBaselines: pick(
      readBoolean('VRT_UPDATE_BASELINES', env.VRT_UPDATE_BASELINES),
      user.updateBaselines,
      defaultConfig.updateBaselines,
    ),
    padDimensionMismatch: pick(
      readBoolean('VRT_PAD_DIMENSION_MISMATCH', env.VRT_PAD_DIMENSION_MISMATCH),
      user.padDimensionMismatch,
      defaultConfig.padDimensionMismatch,
    ),
    includePlatform: pick(
      readBoolean('VRT_INCLUDE_PLATFORM', env.VRT_INCLUDE_PLATFORM),
      user.includePlatform,
      defaultConfig.includePlatform,
    ),
    masks: masksFromEnv ?? user.masks ?? defaultConfig.masks,
    viewports,
    defaultViewport: pick(env.VRT_DEFAULT_VIEWPORT, user.defaultViewport, defaultConfig.defaultViewport),
    approver,
    requiredSelectors: user.requiredSelectors ?? defaultConfig.requiredSelectors,
    waitForNetworkIdle: user.waitForNetworkIdle ?? defaultConfig.waitForNetworkIdle,
    waitForFonts: user.waitForFonts ?? defaultConfig.waitForFonts,
    waitForImages: user.waitForImages ?? defaultConfig.waitForImages,
    disableAnimations: user.disableAnimations ?? defaultConfig.disableAnimations,
  };

  if (!config.viewports[config.defaultViewport]) {
    throw new VrtError(
      `defaultViewport "${config.defaultViewport}" is not defined. Known viewports: ${Object.keys(config.viewports).join(', ')}.`,
    );
  }

  return config;
}
