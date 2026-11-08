import { loadConfig } from '../config/load-config';
import { BaselineManager } from '../baseline/manager';

async function main(): Promise<void> {
  const config = loadConfig();
  const manager = new BaselineManager(config);
  await manager.verify();
  const manifest = await manager.readManifest();
  console.log(`Verified ${Object.keys(manifest.baselines).length} baseline(s) in ${config.baselineDir}.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
