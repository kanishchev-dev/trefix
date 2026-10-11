import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadAuthSession } from "../../lib/auth-session";
import { getHealthSource } from "../health-sync/sources";
import { getActiveHealthSync } from "../health-sync/state";
import type {
  DeviceHealthSource,
  RecordedRunExport,
} from "../health-sync/types";
import type { EngineState, LocationSample } from "./engine/types";

const EXPORT_KEY = "trefix_tracker_health_export";
/** Running costs about one kilocalorie per kilogram per kilometre. */
const KCAL_PER_KG_KM = 1.0;

/** The health store this device syncs with, when it can take our runs. */
export async function healthExportTarget(): Promise<DeviceHealthSource | null> {
  const [session, active] = await Promise.all([
    loadAuthSession(),
    getActiveHealthSync(),
  ]);
  const userId = session?.user.id;
  const source = getHealthSource();
  if (
    !userId ||
    !active ||
    active.userId !== userId ||
    !source ||
    source.provider !== active.provider
  )
    return null;
  return source.saveRecordedRun ? source : null;
}

export function estimateKcal(
  distanceM: number,
  weightKg: number | null | undefined,
): number | null {
  if (!weightKg || weightKg <= 0 || distanceM <= 0) return null;
  return Math.round(weightKg * (distanceM / 1000) * KCAL_PER_KG_KM);
}

export function buildRunExport(
  sessionId: string,
  state: EngineState,
  points: LocationSample[],
  distanceM: number,
  weightKg: number | null | undefined,
): RecordedRunExport {
  return {
    id: sessionId,
    startedAt: new Date(state.startedAt),
    endedAt: new Date(state.endedAt ?? state.clock),
    distanceM: Math.round(distanceM),
    indoor: state.config.environment === "treadmill",
    energyKcal: estimateKcal(distanceM, weightKg),
    elevationGainM:
      points.length > 0 || state.elevation.source === "baro"
        ? Math.round(state.elevation.gainM)
        : null,
    route: points.map(({ t, lat, lng, alt, acc, speed }) => ({
      t,
      lat,
      lng,
      alt,
      acc,
      speed,
    })),
  };
}

export type ExportOutcome = "saved" | "denied" | "failed";

/** Asks for write access the first time, then writes the run. */
export async function exportRun(
  source: DeviceHealthSource,
  run: RecordedRunExport,
): Promise<ExportOutcome> {
  try {
    const access = (await source.getWriteAccess?.()) ?? "not_asked";
    if (access === "denied") return "denied";
    if (access === "not_asked" && !(await source.requestWriteAccess?.()))
      return "denied";
    await source.saveRecordedRun?.(run);
    return "saved";
  } catch {
    return "failed";
  }
}

export async function loadHealthExportEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(EXPORT_KEY)) !== "0";
  } catch {
    return true;
  }
}

export async function saveHealthExportEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPORT_KEY, enabled ? "1" : "0");
  } catch {
    // A preference; the switch keeps its state for this run.
  }
}
