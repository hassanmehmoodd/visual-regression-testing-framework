import { VrtError } from '../errors';

export const SUPPORTED_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

export type SupportedBrowser = (typeof SUPPORTED_BROWSERS)[number];

function isSupportedBrowser(value: string): value is SupportedBrowser {
  return (SUPPORTED_BROWSERS as readonly string[]).includes(value);
}

export function selectedBrowsers(env: NodeJS.ProcessEnv = process.env): SupportedBrowser[] {
  const raw = env.VRT_BROWSERS ?? SUPPORTED_BROWSERS.join(',');
  const names = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const selected: SupportedBrowser[] = [];

  for (const name of names) {
    if (!isSupportedBrowser(name)) {
      throw new VrtError(
        `Unsupported browser "${name}". Expected one of: ${SUPPORTED_BROWSERS.join(', ')}.`,
      );
    }
    if (!selected.includes(name)) {
      selected.push(name);
    }
  }

  if (selected.length === 0) {
    throw new VrtError('VRT_BROWSERS did not select a browser.');
  }

  return selected;
}
