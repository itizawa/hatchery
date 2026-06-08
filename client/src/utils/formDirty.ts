export function isShallowDirty(
  initial: Record<string, unknown>,
  current: Record<string, unknown>
): boolean {
  return Object.keys(current).some((key) => current[key] !== initial[key]);
}
