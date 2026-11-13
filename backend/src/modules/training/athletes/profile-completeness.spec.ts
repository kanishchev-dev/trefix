import { ageFromBirthDate, calculateCompleteness } from './profile-completeness';

describe('profile completeness', () => {
  const empty = {
    birthDate: null,
    sex: null,
    heightCm: null,
    weightKg: null,
    restingHeartRate: null,
    maxHeartRate: null,
    thresholdHeartRate: null,
    availableTrainingDays: [],
    weeklyMileageKm: null,
    limitations: null,
  };

  it('is 0 for an empty profile and 100 for a full one', () => {
    expect(calculateCompleteness(empty).percent).toBe(0);
    expect(
      calculateCompleteness({
        birthDate: '1992-03-14',
        sex: 'male',
        heightCm: 181,
        weightKg: 72.4,
        restingHeartRate: 52,
        maxHeartRate: 189,
        thresholdHeartRate: 172,
        availableTrainingDays: ['monday'],
        weeklyMileageKm: 30,
        limitations: 'knee',
      }),
    ).toEqual({ percent: 100, missing: [] });
  });

  it('counts "no limitations" (empty string) as answered', () => {
    const result = calculateCompleteness({ ...empty, limitations: '' });
    expect(result.percent).toBe(15);
    expect(result.missing).not.toContain('limitations');
  });

  it('computes full years of age', () => {
    expect(ageFromBirthDate('1992-03-14', '2026-03-13')).toBe(33);
    expect(ageFromBirthDate('1992-03-14', '2026-03-14')).toBe(34);
    expect(ageFromBirthDate(null, '2026-03-14')).toBeNull();
  });
});
