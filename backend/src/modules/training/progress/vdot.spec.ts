import { predictSeconds, thresholdPace, trainingPaces, vdotFor } from './vdot';

describe('vdot', () => {
  it('matches Daniels tables within a point', () => {
    // 5 km in 20:00 ≈ VDOT 49.8; 10 km in 40:00 ≈ 51.9; marathon 3:00:00 ≈ 53.5.
    expect(vdotFor(5000, 1200)).toBeCloseTo(49.8, 0);
    expect(vdotFor(10000, 2400)).toBeCloseTo(51.9, 0);
    expect(vdotFor(42195, 10800)).toBeCloseTo(53.5, 0);
  });

  it('predicts times consistent with the VDOT of a result', () => {
    const vdot = vdotFor(5000, 1200)!;
    expect(Math.abs(predictSeconds(vdot, 5000) - 1200)).toBeLessThanOrEqual(1);
    // VDOT 50: 10 km ≈ 41:21, half ≈ 1:31:35.
    expect(Math.abs(predictSeconds(50, 10000) - 2481)).toBeLessThan(25);
    expect(Math.abs(predictSeconds(50, 21097.5) - 5495)).toBeLessThan(60);
  });

  it('derives threshold and training paces', () => {
    // VDOT 50: T ≈ 4:15 /km, E ≈ 4:57–5:35 /km.
    expect(Math.abs(thresholdPace(50) - 255)).toBeLessThan(6);
    const paces = trainingPaces(50);
    expect(paces.easy[0]).toBeLessThan(paces.easy[1]);
    expect(paces.interval[0]).toBeLessThan(paces.tempo[0]);
  });
});
