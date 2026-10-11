import AsyncStorage from "@react-native-async-storage/async-storage";

const STRIDE_KEY = "trefix_tracker_stride_m";
/** Weight of a new run in the learned stride: recent runs matter more, one odd run does not dominate. */
const LEARNING_RATE = 0.3;
/** Running step length as a share of height, when nothing was learned yet. */
const STRIDE_PER_HEIGHT = 0.6;
const DEFAULT_STRIDE_M = 1.05;

export async function loadStride(heightCm: number | null | undefined): Promise<number> {
  try {
    const stored = Number(await AsyncStorage.getItem(STRIDE_KEY));
    if (Number.isFinite(stored) && stored > 0) return stored;
  } catch {
    // Fall back to the estimate below.
  }
  return heightCm ? Math.round((heightCm / 100) * STRIDE_PER_HEIGHT * 100) / 100 : DEFAULT_STRIDE_M;
}

export async function learnStride(measured: number): Promise<void> {
  try {
    const stored = Number(await AsyncStorage.getItem(STRIDE_KEY));
    const next = Number.isFinite(stored) && stored > 0 ? stored + (measured - stored) * LEARNING_RATE : measured;
    await AsyncStorage.setItem(STRIDE_KEY, String(Math.round(next * 1000) / 1000));
  } catch {
    // Calibration is best effort.
  }
}
