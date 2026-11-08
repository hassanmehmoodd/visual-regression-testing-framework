import { BaselineManager } from '../src/baseline/manager';
import { createSolidPng } from '../src/comparison/image';
import { loadConfig } from '../src/config/load-config';

const config = loadConfig();
const manager = new BaselineManager(config);
const png = createSolidPng(48, 48, [255, 0, 170, 255]);
const receipt = await manager.approve(
  { suite: 'dimensions', name: 'mismatch', browser: 'chromium', viewport: 'desktop' },
  png,
  config.approver,
);
console.log(
  `${receipt.unchanged ? 'Unchanged' : 'Seeded'} ${receipt.key} version ${receipt.version} (${receipt.sha256.slice(0, 12)}).`,
);
