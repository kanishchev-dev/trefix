/** `CoachSession` / `userId` → `COACH_SESSION` / `USER_ID`: the shape of every error code. */
export function toErrorCodePart(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toUpperCase();
}
