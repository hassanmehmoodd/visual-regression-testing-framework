import { expect } from '@playwright/test';
import type { VisualCheckResult } from '../../src/model';

export function expectStable(result: VisualCheckResult): void {
  const raw = process.env.VRT_UPDATE_BASELINES?.trim().toLowerCase();
  const updating = raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  if (updating) {
    expect(['passed', 'baseline-created']).toContain(result.status);
    return;
  }
  expect(result.status, result.message).toBe('passed');
}
