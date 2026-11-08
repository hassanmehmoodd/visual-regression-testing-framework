export const DEMO_VARIANTS = ['stable', 'color', 'font', 'spacing', 'size', 'layout', 'missing'] as const;

export type DemoVariant = (typeof DEMO_VARIANTS)[number];

export function resolveVariant(query: string | null, envValue: string | undefined): DemoVariant {
  const requested = query && query.length > 0 ? query : envValue && envValue.length > 0 ? envValue : 'stable';
  if ((DEMO_VARIANTS as readonly string[]).includes(requested)) {
    return requested as DemoVariant;
  }
  return 'stable';
}
