export function parseArgs(argv: readonly string[]): Map<string, string | true> {
  const parsed = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined || !token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      parsed.set(key, true);
    } else {
      parsed.set(key, next);
      index += 1;
    }
  }
  return parsed;
}

export function readOption(args: Map<string, string | true>, name: string): string | undefined {
  const value = args.get(name);
  return typeof value === 'string' ? value : undefined;
}
