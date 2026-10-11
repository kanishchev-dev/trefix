import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock("../../lib/auth-session", () => ({ loadAuthSession: vi.fn() }));
vi.mock("../health-sync/sources", () => ({ getHealthSource: vi.fn() }));
vi.mock("../health-sync/state", () => ({ getActiveHealthSync: vi.fn() }));

import type {
  DeviceHealthSource,
  RecordedRunExport,
} from "../health-sync/types";
import { RecordingEngine } from "./engine/recording-engine";
import { buildRunExport, estimateKcal, exportRun } from "./health-export";

const run: RecordedRunExport = {
  id: "s1",
  startedAt: new Date(0),
  endedAt: new Date(1000),
  distanceM: 5000,
  indoor: false,
  energyKcal: 350,
  elevationGainM: null,
  route: [],
};

function source(access: "granted" | "denied" | "not_asked", grant = true) {
  return {
    getWriteAccess: vi.fn(async () => access),
    requestWriteAccess: vi.fn(async () => grant),
    saveRecordedRun: vi.fn(async () => undefined),
  } as unknown as DeviceHealthSource &
    Record<
      "getWriteAccess" | "requestWriteAccess" | "saveRecordedRun",
      ReturnType<typeof vi.fn>
    >;
}

describe("health export", () => {
  it("estimates calories from weight and distance", () => {
    expect(estimateKcal(10_000, 70)).toBe(700);
    expect(estimateKcal(10_000, null)).toBeNull();
  });

  it("describes a treadmill run without a route", () => {
    const engine = RecordingEngine.start(
      {
        environment: "treadmill",
        distanceMode: "time",
        strideM: 1,
        autoPause: false,
      },
      1000,
    );
    engine.finish(61_000);
    const exported = buildRunExport("s1", engine.state, [], 812.4, 70);
    expect(exported).toMatchObject({
      id: "s1",
      indoor: true,
      distanceM: 812,
      energyKcal: 57,
      elevationGainM: null,
      route: [],
    });
    expect(exported.endedAt.getTime()).toBe(61_000);
  });

  it("asks once, then writes", async () => {
    const fresh = source("not_asked");
    expect(await exportRun(fresh, run)).toBe("saved");
    expect(fresh.requestWriteAccess).toHaveBeenCalled();

    const granted = source("granted");
    expect(await exportRun(granted, run)).toBe("saved");
    expect(granted.requestWriteAccess).not.toHaveBeenCalled();
  });

  it("does not write without access", async () => {
    const refused = source("not_asked", false);
    expect(await exportRun(refused, run)).toBe("denied");
    expect(refused.saveRecordedRun).not.toHaveBeenCalled();
    expect(await exportRun(source("denied"), run)).toBe("denied");
  });
});
