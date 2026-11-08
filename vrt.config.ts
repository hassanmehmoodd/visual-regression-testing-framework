import type { UserConfig } from './src/config/types';

const config: UserConfig = {
  baselineDir: 'baselines',
  actualDir: 'test-results/visual/actual',
  diffDir: 'test-results/visual/diff',
  pendingDir: 'test-results/visual/pending',
  reportDir: 'test-results/visual/report',
  resultsDir: 'test-results/visual/results',
  historyDir: 'baselines/history',
  threshold: 0.1,
  maxDiffPixelRatio: 0.002,
  maxDiffPixels: null,
  ignoreAntialiasing: true,
  updateBaselines: false,
  padDimensionMismatch: true,
  includePlatform: false,
  defaultViewport: 'desktop',
  approver: 'Hassan Mehmood',
  masks: [
    '[data-vrt="timestamp"]',
    '[data-vrt="random-id"]',
    '[data-vrt="avatar"]',
    '[data-vrt="ad"]',
  ],
  requiredSelectors: ['[data-testid="app-ready"][data-ready="true"]'],
  waitForNetworkIdle: true,
  waitForFonts: true,
  waitForImages: true,
  disableAnimations: true,
  viewports: {
    desktop: { width: 1280, height: 800 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 390, height: 844 },
  },
};

export default config;
