export const CHECK_STATUSES = [
  'passed',
  'failed',
  'missing-baseline',
  'dimension-mismatch',
  'baseline-created',
] as const;

export type CheckStatus = (typeof CHECK_STATUSES)[number];

export interface ScreenshotIdentity {
  suite: string;
  name: string;
  browser: string;
  viewport: string;
}

export interface VisualPaths {
  baseline: string;
  actual: string;
  diff: string | null;
  pending: string | null;
}

export interface VisualCheckResult {
  key: string;
  baselineKey: string;
  suite: string;
  name: string;
  label: string;
  browser: string;
  viewport: string;
  status: CheckStatus;
  message: string;
  diffPixels: number;
  diffPixelRatio: number;
  totalPixels: number;
  threshold: number;
  maxDiffPixelRatio: number;
  maxDiffPixels: number | null;
  ignoreAntialiasing: boolean;
  dimensionMismatch: boolean;
  padded: boolean;
  baselineWidth: number | null;
  baselineHeight: number | null;
  actualWidth: number | null;
  actualHeight: number | null;
  paths: VisualPaths;
  baselineExists: boolean;
  actualExists: boolean;
  diffExists: boolean;
  completedAt: string;
}

export interface ApprovalReceipt {
  key: string;
  version: number;
  sha256: string;
  approver: string;
  approvedAt: string;
  baselinePath: string;
  archivedPath: string | null;
  unchanged: boolean;
}
