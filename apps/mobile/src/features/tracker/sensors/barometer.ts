import { Barometer } from "expo-sensors";

const SEA_LEVEL_HPA = 1013.25;
const UPDATE_MS = 1000;
/** Readings averaged together: a single one jitters by about a metre. */
const SMOOTHING_WINDOW = 5;

/** Barometric altitude, metres. Absolute value drifts with the weather; its changes over a run are accurate. */
export function pressureToAltitudeM(pressureHpa: number): number {
  return 44_330 * (1 - Math.pow(pressureHpa / SEA_LEVEL_HPA, 1 / 5.255));
}

/** Smoothed altitude from the barometer; null when the phone has none. */
export async function watchAltitude(onAltitude: (altM: number) => void): Promise<{ remove: () => void } | null> {
  const available = await Barometer.isAvailableAsync().catch(() => false);
  if (!available) return null;
  const window: number[] = [];
  Barometer.setUpdateInterval(UPDATE_MS);
  return Barometer.addListener(({ pressure }) => {
    if (!Number.isFinite(pressure) || pressure <= 0) return;
    window.push(pressureToAltitudeM(pressure));
    if (window.length > SMOOTHING_WINDOW) window.shift();
    if (window.length === SMOOTHING_WINDOW) onAltitude(window.reduce((sum, value) => sum + value, 0) / window.length);
  });
}
