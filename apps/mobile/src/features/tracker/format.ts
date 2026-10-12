import {
  formatMinutesSeconds,
  kmToDisplay,
  paceToDisplay,
  type UnitSystem,
} from "@trefix/utils";

/** 0:42, 12:05, 1:03:17 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Pace without units, "5:07"; a dash when unknown or implausibly slow. */
export function formatPaceValue(
  secPerKm: number | null,
  units: UnitSystem,
): string {
  if (
    secPerKm === null ||
    !Number.isFinite(secPerKm) ||
    secPerKm <= 0 ||
    secPerKm > 30 * 60
  )
    return "–:––";
  return formatMinutesSeconds(paceToDisplay(secPerKm, units));
}

/** Distance in the user's units with two decimals, without the unit: "3,27". */
export function formatDistanceValue(
  metres: number,
  units: UnitSystem,
  locale: string,
): string {
  const value = kmToDisplay(metres / 1000, units);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.floor(value * 100) / 100);
}
