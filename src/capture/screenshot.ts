import type { Locator, Page } from '@playwright/test';

export interface CaptureTarget {
  fullPage: boolean;
  selector?: string;
  masks: readonly string[];
}

export async function captureScreenshot(page: Page, target: CaptureTarget): Promise<Buffer> {
  const masks: Locator[] = [];
  for (const selector of target.masks) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) {
      masks.push(locator);
    }
  }

  const options = {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    scale: 'css' as const,
    type: 'png' as const,
    mask: masks,
    timeout: 30_000,
  };

  if (target.selector) {
    const element = page.locator(target.selector).first();
    await element.waitFor({ state: 'visible', timeout: 15_000 });
    return element.screenshot(options);
  }

  return page.screenshot({ ...options, fullPage: target.fullPage });
}
