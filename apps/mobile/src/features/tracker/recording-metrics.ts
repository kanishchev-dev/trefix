import AsyncStorage from "@react-native-async-storage/async-storage";

import type { EngineState, EngineView } from "./engine/types";

/** Live values a cell of the recording screen can show. */
export type MetricKey =
  | "time"
  | "distance"
  | "pace"
  | "splitPace"
  | "avgPace"
  | "elevation"
  | "cadence";

export const METRIC_KEYS: MetricKey[] = [
  "time",
  "distance",
  "pace",
  "splitPace",
  "avgPace",
  "elevation",
  "cadence",
];

/** Cells under the big distance of a free run; the runner replaces them with a long press. */
export const DEFAULT_CELLS: MetricKey[] = [
  "time",
  "pace",
  "elevation",
  "avgPace",
];

const CELLS_KEY = "trefix_tracker_cells";

export async function loadCells(): Promise<MetricKey[]> {
  try {
    const raw = await AsyncStorage.getItem(CELLS_KEY);
    if (!raw) return DEFAULT_CELLS;
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_CELLS.length &&
      parsed.every((key) => METRIC_KEYS.includes(key as MetricKey))
    )
      return parsed as MetricKey[];
    return DEFAULT_CELLS;
  } catch {
    return DEFAULT_CELLS;
  }
}

export async function saveCells(cells: MetricKey[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CELLS_KEY, JSON.stringify(cells));
  } catch {
    // A preference; the screen keeps what was picked for this run.
  }
}

/**
 * Pace of the last `unitM` metres (a kilometre or a mile), from the recorded
 * timeline; the average pace until the first one is run.
 */
export function lastUnitPace(
  state: EngineState | null,
  view: EngineView,
  unitM = 1000,
): number | null {
  if (!state || view.distanceM < unitM) return view.avgPaceSecPerKm;
  const target = view.distanceM - unitM;
  const timeline = state.timeline;
  let low = 0;
  let high = timeline.length - 1;
  let found: [number, number, number] | null = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const sample = timeline[mid]!;
    if (sample[1] <= target) {
      found = sample;
      low = mid + 1;
    } else high = mid - 1;
  }
  if (!found) return view.avgPaceSecPerKm;
  const metres = view.distanceM - found[1];
  if (metres < 50) return view.avgPaceSecPerKm;
  // ms per metre is seconds per kilometre.
  return (view.movingMs - found[0]) / metres;
}

/** How long the current pause has lasted, ms; 0 while running. */
export function pauseDurationMs(
  state: EngineState | null,
  now: number,
): number {
  const last = state?.pauses[state.pauses.length - 1];
  if (!last || last.endedAt !== null) return 0;
  return Math.max(0, now - last.startedAt);
}
