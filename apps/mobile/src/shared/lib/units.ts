/** Display conversion of metric values. The API always stores metric; `units` only affects what the user sees. */
export type UnitSystem = "metric" | "imperial";

const KM_PER_MILE = 1.609344;
const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

type Labels = {
  km: string;
  mi: string;
  kg: string;
  lb: string;
  cm: string;
  ft: string;
  in: string;
  perKm: string;
  perMi: string;
};

const round = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Locale-aware number with a fixed number of decimals ("72,4" in ru). */
export function formatNumber(value: number, digits: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
}

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

export function formatDistance(km: number, units: UnitSystem, labels: Labels, locale: string, digits = 1): string {
  return `${formatNumber(round(kmToDisplay(km, units), digits), digits, locale)} ${units === "imperial" ? labels.mi : labels.km}`;
}

export function formatWeight(kg: number, units: UnitSystem, labels: Labels, locale: string): string {
  return `${formatNumber(round(kgToDisplay(kg, units), 1), 1, locale)} ${units === "imperial" ? labels.lb : labels.kg}`;
}

export function formatHeight(cm: number, units: UnitSystem, labels: Labels): string {
  if (units === "imperial") {
    const totalInches = Math.round(cm / CM_PER_INCH);
    return `${Math.floor(totalInches / 12)} ${labels.ft} ${totalInches % 12} ${labels.in}`;
  }
  return `${Math.round(cm)} ${labels.cm}`;
}

/** Pace from seconds per km, as m:ss per km or per mile. */
export function formatPace(secondsPerKm: number, units: UnitSystem, labels: Labels): string {
  const seconds = Math.round(units === "imperial" ? secondsPerKm * KM_PER_MILE : secondsPerKm);
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest} ${units === "imperial" ? labels.perMi : labels.perKm}`;
}

export type UnitLabels = Labels;
