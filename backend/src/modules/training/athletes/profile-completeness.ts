export interface CompletenessInput {
  birthDate: string | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  restingHeartRate: number | null;
  maxHeartRate: number | null;
  thresholdHeartRate: number | null;
  availableTrainingDays: string[];
  weeklyMileageKm: number | null;
  limitations: string | null;
}

export interface ProfileCompleteness {
  percent: number;
  missing: Array<keyof CompletenessInput>;
}

/** Field weights; they add up to 100. */
const WEIGHTS: Record<keyof CompletenessInput, number> = {
  birthDate: 10,
  sex: 10,
  heightCm: 10,
  weightKg: 10,
  restingHeartRate: 10,
  maxHeartRate: 10,
  thresholdHeartRate: 15,
  availableTrainingDays: 5,
  weeklyMileageKm: 5,
  limitations: 15,
};

const isFilled = (key: keyof CompletenessInput, input: CompletenessInput): boolean => {
  const value = input[key];
  if (key === 'availableTrainingDays') {
    return Array.isArray(value) && value.length > 0;
  }
  // An empty string means "no limitations" — that is an answer.
  if (key === 'limitations') {
    return value !== null && value !== undefined;
  }
  return value !== null && value !== undefined && value !== '';
};

/** How complete the athlete profile is, with the missing fields in display order. */
export function calculateCompleteness(input: CompletenessInput): ProfileCompleteness {
  const keys = Object.keys(WEIGHTS) as Array<keyof CompletenessInput>;
  const missing = keys.filter((key) => !isFilled(key, input));
  const percent = keys.reduce((sum, key) => sum + (missing.includes(key) ? 0 : WEIGHTS[key]), 0);
  return { percent, missing };
}

/** Full years between an ISO birth date and `today` (ISO). */
export function ageFromBirthDate(birthDate: string | null, today: string): number | null {
  if (!birthDate) {
    return null;
  }
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (!by || !ty) {
    return null;
  }
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) {
    age -= 1;
  }
  return age;
}
