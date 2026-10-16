/** Before and after values of the fields an update touched. */
export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value === undefined ? null : value;
}

function isEqual(left: unknown, right: unknown): boolean {
  if (left !== null && typeof left === 'object') {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

/**
 * Compares the given fields of two snapshots of the same entity. Dates are
 * stored as ISO strings and objects by value, so the result is JSON-safe.
 */
export function diffFields<T extends object>(before: T, after: T, fields: readonly (keyof T)[]): FieldChanges {
  const changes: FieldChanges = {};
  for (const field of fields) {
    const from = normalize(before[field]);
    const to = normalize(after[field]);
    if (!isEqual(from, to)) {
      changes[String(field)] = { from, to };
    }
  }
  return changes;
}
