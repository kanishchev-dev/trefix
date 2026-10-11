/**
 * `target` of a workout is a free-form object from the training engine; these
 * read its optional text fields without `any`.
 */
export function workoutTargetText(
  target: unknown,
  key: "title" | "description",
): string | undefined {
  if (!target || typeof target !== "object") {
    return undefined;
  }
  const value = (target as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
