export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keys present in the raw payload that did not survive parsing. */
export function droppedKeys(
  raw: unknown,
  parsed: unknown,
  path = "$",
): string[] {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    return raw.flatMap((item, index) =>
      droppedKeys(item, parsed[index], `${path}[${index}]`),
    );
  }
  if (!isRecord(raw) || !isRecord(parsed)) return [];
  return Object.entries(raw).flatMap(([key, value]) => {
    if (value === undefined) return [];
    if (!(key in parsed)) return [`${path}.${key}`];
    return droppedKeys(value, parsed[key], `${path}.${key}`);
  });
}
