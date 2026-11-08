import { test as base, expect, type Page } from '@playwright/test';
import { BaselineManager, type CompareRequest } from '../baseline/manager';
import { captureScreenshot } from '../capture/screenshot';
import { stabilize, type StabilizationOptions } from '../capture/stabilize';
import { loadConfig } from '../config/load-config';
import type { Viewport, VrtConfig } from '../config/types';
import { VrtError } from '../errors';
import type { ScreenshotIdentity, VisualCheckResult } from '../model';
import { recordResult } from '../report/results-store';

export interface VisualCheckOptions {
  suite: string;
  name: string;
  browser?: string;
  viewport?: string;
  fullPage?: boolean;
  selector?: string;
  goto?: string;
  masks?: readonly string[];
  baseline?: { suite: string; name: string };
  threshold?: number;
  maxDiffPixelRatio?: number;
  maxDiffPixels?: number | null;
  ignoreAntialiasing?: boolean;
  padDimensionMismatch?: boolean;
  updateBaseline?: boolean;
  requiredSelectors?: readonly string[];
  label?: string;
}

export interface CaptureOptions {
  viewport?: string;
  fullPage?: boolean;
  selector?: string;
  goto?: string;
  masks?: readonly string[];
  requiredSelectors?: readonly string[];
}

export interface VisualApi {
  check(options: VisualCheckOptions): Promise<VisualCheckResult>;
  capture(options?: CaptureOptions): Promise<Buffer>;
}

export const test = base.extend<{ visual: VisualApi }>({
  visual: async ({ page }, use, testInfo) => {
    const config = loadConfig();
    const manager = new BaselineManager(config);
    const api: VisualApi = {
      capture: (options) => capturePrepared(page, config, options ?? {}),
      check: async (options) => {
        const browser = options.browser ?? testInfo.project.name;
        const viewportName = options.viewport ?? config.defaultViewport;
        const buffer = await capturePrepared(page, config, {
          viewport: viewportName,
          fullPage: options.fullPage ?? false,
          ...(options.selector === undefined ? {} : { selector: options.selector }),
          ...(options.goto === undefined ? {} : { goto: options.goto }),
          ...(options.masks === undefined ? {} : { masks: options.masks }),
          ...(options.requiredSelectors === undefined ? {} : { requiredSelectors: options.requiredSelectors }),
        });
        const identity: ScreenshotIdentity = {
          suite: options.suite,
          name: options.name,
          browser,
          viewport: viewportName,
        };
        const request: CompareRequest = {
          identity,
          actual: buffer,
          threshold: options.threshold ?? config.threshold,
          maxDiffPixelRatio: options.maxDiffPixelRatio ?? config.maxDiffPixelRatio,
          maxDiffPixels: options.maxDiffPixels === undefined ? config.maxDiffPixels : options.maxDiffPixels,
          ignoreAntialiasing: options.ignoreAntialiasing ?? config.ignoreAntialiasing,
          padDimensionMismatch: options.padDimensionMismatch ?? config.padDimensionMismatch,
          updateBaseline: options.updateBaseline ?? config.updateBaselines,
        };
        if (options.baseline) {
          request.baselineIdentity = {
            suite: options.baseline.suite,
            name: options.baseline.name,
            browser,
            viewport: viewportName,
          };
        }
        if (options.label !== undefined) {
          request.label = options.label;
        }
        const result = await manager.compare(request);
        await recordResult(config, result);
        return result;
      },
    };
    await use(api);
  },
});

async function capturePrepared(page: Page, config: VrtConfig, options: CaptureOptions): Promise<Buffer> {
  const viewportName = options.viewport ?? config.defaultViewport;
  const viewport = config.viewports[viewportName];
  if (!viewport) {
    throw new VrtError(
      `Unknown viewport "${viewportName}". Known viewports: ${Object.keys(config.viewports).join(', ')}.`,
    );
  }
  await applyViewport(page, viewport);
  if (options.goto) {
    await page.goto(options.goto, { waitUntil: config.waitForNetworkIdle ? 'networkidle' : 'load' });
  }
  const stabilization: StabilizationOptions = {
    waitForNetworkIdle: config.waitForNetworkIdle,
    waitForFonts: config.waitForFonts,
    waitForImages: config.waitForImages,
    disableAnimations: config.disableAnimations,
    requiredSelectors: [...config.requiredSelectors, ...(options.requiredSelectors ?? [])],
  };
  await stabilize(page, stabilization);
  return captureScreenshot(page, {
    fullPage: options.fullPage ?? false,
    ...(options.selector === undefined ? {} : { selector: options.selector }),
    masks: options.masks ?? config.masks,
  });
}

async function applyViewport(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
}

export { expect };
