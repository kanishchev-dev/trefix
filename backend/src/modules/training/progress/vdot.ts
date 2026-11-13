/**
 * Jack Daniels' VDOT model: oxygen cost of running at a velocity and the share
 * of VO2max sustainable for a duration. Pure functions, metres and minutes.
 */

/** VO2 (ml/kg/min) at velocity `v`, metres per minute. */
export function oxygenCost(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/** Share of VO2max that can be held for `t` minutes. */
export function sustainableShare(t: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

/** VDOT of a performance: `distanceM` metres in `timeSeconds`. */
export function vdotFor(distanceM: number, timeSeconds: number): number | null {
  if (distanceM <= 0 || timeSeconds <= 0) return null;
  const t = timeSeconds / 60;
  const value = oxygenCost(distanceM / t) / sustainableShare(t);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Time in seconds a runner with `vdot` needs for `distanceM` (bisection). */
export function predictSeconds(vdot: number, distanceM: number): number {
  let low = (distanceM / 1000) * 120; // 2:00 /km
  let high = (distanceM / 1000) * 1200; // 20:00 /km
  for (let index = 0; index < 60; index += 1) {
    const mid = (low + high) / 2;
    const value = vdotFor(distanceM, mid) ?? 0;
    // A longer time means a lower VDOT.
    if (value > vdot) low = mid;
    else high = mid;
  }
  return Math.round((low + high) / 2);
}

/** Velocity (m/min) at which oxygen cost equals `vo2`. */
export function velocityForVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** Pace, seconds per km, at `share` of VDOT. */
export function paceAtShare(vdot: number, share: number): number {
  return Math.round((1000 / velocityForVo2(vdot * share)) * 60);
}

/** Threshold pace: about 88% of VDOT. */
export function thresholdPace(vdot: number): number {
  return paceAtShare(vdot, 0.88);
}

/** Training pace ranges in seconds per km, fast edge first. */
export function trainingPaces(vdot: number): {
  easy: [number, number];
  tempo: [number, number];
  interval: [number, number];
} {
  return {
    easy: [paceAtShare(vdot, 0.74), paceAtShare(vdot, 0.65)],
    tempo: [paceAtShare(vdot, 0.88), paceAtShare(vdot, 0.83)],
    interval: [paceAtShare(vdot, 1.0), paceAtShare(vdot, 0.95)],
  };
}
