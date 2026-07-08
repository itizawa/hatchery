export function hasNoUpdateFields({
  displayName,
  role,
  personality,
  verbosity,
}: {
  displayName: string | undefined;
  role: string | undefined;
  personality: string | undefined;
  verbosity: string | undefined;
}): boolean {
  return displayName === undefined && role === undefined && personality === undefined && verbosity === undefined;
}
