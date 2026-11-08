export interface Viewport {
  width: number;
  height: number;
}

export interface VrtConfig {
  baselineDir: string;
  actualDir: string;
  diffDir: string;
  pendingDir: string;
  reportDir: string;
  resultsDir: string;
  historyDir: string;
  threshold: number;
  maxDiffPixelRatio: number;
  maxDiffPixels: number | null;
  ignoreAntialiasing: boolean;
  updateBaselines: boolean;
  padDimensionMismatch: boolean;
  includePlatform: boolean;
  masks: readonly string[];
  viewports: Readonly<Record<string, Viewport>>;
  defaultViewport: string;
  approver: string;
  requiredSelectors: readonly string[];
  waitForNetworkIdle: boolean;
  waitForFonts: boolean;
  waitForImages: boolean;
  disableAnimations: boolean;
}

export interface UserConfig {
  baselineDir?: string;
  actualDir?: string;
  diffDir?: string;
  pendingDir?: string;
  reportDir?: string;
  resultsDir?: string;
  historyDir?: string;
  threshold?: number;
  maxDiffPixelRatio?: number;
  maxDiffPixels?: number | null;
  ignoreAntialiasing?: boolean;
  updateBaselines?: boolean;
  padDimensionMismatch?: boolean;
  includePlatform?: boolean;
  masks?: readonly string[];
  viewports?: Readonly<Record<string, Viewport>>;
  defaultViewport?: string;
  approver?: string;
  requiredSelectors?: readonly string[];
  waitForNetworkIdle?: boolean;
  waitForFonts?: boolean;
  waitForImages?: boolean;
  disableAnimations?: boolean;
}
