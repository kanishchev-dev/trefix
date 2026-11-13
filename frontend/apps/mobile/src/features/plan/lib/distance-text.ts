import { formatNumber, kmToDisplay } from "../../../shared/lib/units";
import { type Formatter } from "../../profile/lib/profile-format";

/** Distance as a bare number in the user's units, for "18 / 48 km" pairs. */
export function distanceNumber(km: number, format: Formatter): string {
  return formatNumber(
    Math.round(kmToDisplay(km, format.units)),
    0,
    format.locale,
  );
}

/** "18 / 48 km" in the user's units. */
export function distancePair(
  actualKm: number,
  plannedKm: number,
  format: Formatter,
): string {
  return `${distanceNumber(actualKm, format)} / ${format.distance(plannedKm, 0)}`;
}
