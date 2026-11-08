import { defineConfig, type Project } from '@playwright/test';
import { selectedBrowsers, type SupportedBrowser } from './src/config/browsers';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;
const browsers = selectedBrowsers();

const browserProjects: Project[] = browsers.map((browserName) => ({
  name: browserName,
  testDir: './tests/visual',
  use: {
    browserName,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
  ...(browserName === 'chromium' ? {} : { grep: /@cross-browser/ }),
}));

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  globalSetup: './src/playwright/global-setup.ts',
  use: {
    baseURL,
    timezoneId: 'UTC',
    locale: 'en-US',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: 'npx tsx demo/server.ts',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { PORT: String(port) },
  },
  projects: [
    ...browserProjects,
    {
      name: 'report',
      testDir: './tests/report',
      dependencies: browsers,
    },
  ],
  ...(process.env.CI ? { retries: 1, workers: 2 } : { retries: 0 }),
});

export type { SupportedBrowser };
