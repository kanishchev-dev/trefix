/** Unit conversions for HealthKit quantities (units come as HealthKit unit strings). */

type QuantityLike = { quantity: number; unit: string } | null | undefined;

const SECONDS: Record<string, number> = {
  s: 1,
  ms: 0.001,
  min: 60,
  hr: 3600,
  h: 3600,
};
const METERS: Record<string, number> = {
  m: 1,
  km: 1000,
  cm: 0.01,
  mi: 1609.344,
  ft: 0.3048,
  yd: 0.9144,
};
const KILOCALORIES: Record<string, number> = {
  kcal: 1,
  Cal: 1,
  cal: 0.001,
  kJ: 0.239006,
  J: 0.000239006,
};
const KILOGRAMS: Record<string, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  st: 6.35029318,
};

function convert(
  value: QuantityLike,
  table: Record<string, number>,
): number | undefined {
  if (!value || !Number.isFinite(value.quantity)) return undefined;
  const factor = table[value.unit];
  return factor === undefined ? undefined : value.quantity * factor;
}

export const toSeconds = (value: QuantityLike): number | undefined =>
  convert(value, SECONDS);
export const toMeters = (value: QuantityLike): number | undefined =>
  convert(value, METERS);
export const toKilocalories = (value: QuantityLike): number | undefined =>
  convert(value, KILOCALORIES);
export const toKilograms = (value: QuantityLike): number | undefined =>
  convert(value, KILOGRAMS);

/** Rounds and drops non-finite or non-positive values. */
export function positiveRound(
  value: number | undefined | null,
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value) ||
    value <= 0
  )
    return undefined;
  return Math.round(value);
}
