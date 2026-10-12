import {
  CM_PER_INCH,
  formatMinutesSeconds,
  formatNumber,
  kgToDisplay,
  kmToDisplay,
  paceToDisplay,
  type UnitSystem,
} from "@trefix/utils";

/** Display conversion of metric values: conversions live in `@trefix/utils`, labels in the app copy. */
export {
  displayToKg,
  displayToKm,
  formatNumber,
  kgToDisplay,
  kmToDisplay,
  type UnitSystem,
} from "@trefix/utils";

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

export function formatDistance(
  km: number,
  units: UnitSystem,
  labels: Labels,
  locale: string,
  digits = 1,
): string {
  return `${formatNumber(round(kmToDisplay(km, units), digits), digits, locale)} ${units === "imperial" ? labels.mi : labels.km}`;
}

export function formatWeight(
  kg: number,
  units: UnitSystem,
  labels: Labels,
  locale: string,
): string {
  return `${formatNumber(round(kgToDisplay(kg, units), 1), 1, locale)} ${units === "imperial" ? labels.lb : labels.kg}`;
}

export function formatHeight(
  cm: number,
  units: UnitSystem,
  labels: Labels,
): string {
  if (units === "imperial") {
    const totalInches = Math.round(cm / CM_PER_INCH);
    return `${Math.floor(totalInches / 12)} ${labels.ft} ${totalInches % 12} ${labels.in}`;
  }
  return `${Math.round(cm)} ${labels.cm}`;
}

/** Pace from seconds per km, as m:ss per km or per mile. */
export function formatPace(
  secondsPerKm: number,
  units: UnitSystem,
  labels: Labels,
): string {
  return `${formatMinutesSeconds(paceToDisplay(secondsPerKm, units))} ${units === "imperial" ? labels.perMi : labels.perKm}`;
}

export type UnitLabels = Labels;
