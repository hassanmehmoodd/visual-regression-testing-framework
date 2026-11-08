import userConfig from '../../vrt.config';
import { resolveConfig } from './resolve';
import type { VrtConfig } from './types';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): VrtConfig {
  return resolveConfig(userConfig, env);
}
