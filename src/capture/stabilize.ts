import type { Page } from '@playwright/test';

export interface StabilizationOptions {
  waitForNetworkIdle: boolean;
  waitForFonts: boolean;
  waitForImages: boolean;
  disableAnimations: boolean;
  requiredSelectors: readonly string[];
}

const DISABLE_MOTION_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

export async function stabilize(page: Page, options: StabilizationOptions): Promise<void> {
  if (options.waitForNetworkIdle) {
    await page.waitForLoadState('networkidle');
  }

  for (const selector of options.requiredSelectors) {
    await page.locator(selector).first().waitFor({ state: 'attached', timeout: 15_000 });
  }

  if (options.disableAnimations) {
    await page.addStyleTag({ content: DISABLE_MOTION_CSS });
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.finish();
      }
    });
  }

  if (options.waitForFonts || options.waitForImages) {
    await page.evaluate(
      async ({ waitForFonts, waitForImages }) => {
        if (waitForFonts) {
          await document.fonts.ready;
        }
        if (waitForImages) {
          const images = Array.from(document.images);
          await Promise.all(
            images.map(async (image) => {
              if (!image.complete) {
                await new Promise<void>((resolve) => {
                  image.addEventListener('load', () => {
                    resolve();
                  }, { once: true });
                  image.addEventListener('error', () => {
                    resolve();
                  }, { once: true });
                });
              }
              try {
                await image.decode();
              } catch {
                // A broken image should not hang the capture. The screenshot still records it.
              }
            }),
          );
        }
      },
      { waitForFonts: options.waitForFonts, waitForImages: options.waitForImages },
    );
  }
}
