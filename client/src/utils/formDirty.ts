export function isShallowDirty(
  initial: Record<string, unknown>,
  current: Record<string, unknown>
): boolean {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
  return Array.from(keys).some((key) => current[key] !== initial[key]);
}
