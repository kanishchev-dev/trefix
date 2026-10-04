/**
 * Placeholder initials for an avatar.
 *
 * Takes the first letter of at most two words, so "Иван Петров" becomes "ИП"
 * rather than the first two letters of the whole string. Returns `fallback` when
 * there is nothing to take a letter from.
 */
export function toInitials(name: string, fallback = "U"): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return initials || fallback;
}