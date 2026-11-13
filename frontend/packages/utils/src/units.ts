/** The API stores metric values; the unit system only changes what the user sees. */
export type UnitSystem = "metric" | "imperial";

export const KM_PER_MILE = 1.609344;
export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;

export function kmToDisplay(km: number, units: UnitSystem): number {
  return units === "imperial" ? km / KM_PER_MILE : km;
}

export function displayToKm(value: number, units: UnitSystem): number {
  return units === "imperial" ? value * KM_PER_MILE : value;
}

export function kgToDisplay(kg: number, units: UnitSystem): number {
  return units === "imperial" ? kg / KG_PER_LB : kg;
}

export function displayToKg(value: number, units: UnitSystem): number {
  return units === "imperial" ? value * KG_PER_LB : value;
}

/** Pace in seconds per displayed unit: per km, or per mile in imperial. */
export function paceToDisplay(secondsPerKm: number, units: UnitSystem): number {
  return units === "imperial" ? secondsPerKm * KM_PER_MILE : secondsPerKm;
}

/** Locale-aware number with at most `digits` decimals ("72,4" in ru). */
export function formatNumber(
  value: number,
  digits: number,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}
