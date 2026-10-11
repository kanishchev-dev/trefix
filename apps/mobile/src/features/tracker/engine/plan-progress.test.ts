import { describe, expect, it } from "vitest";

import type { ExecutionStep } from "@workspace/api-client";

import {
  advancePlan,
  closePlan,
  paceStatus,
  skipStep,
  startPlan,
  stepProgress,
} from "./plan-progress";
import { RecordingEngine } from "./recording-engine";

const step = (index: number, patch: Partial<ExecutionStep>): ExecutionStep => ({
  index,
  kind: "steady",
  durationSec: null,
  distanceM: null,
  targetPace: null,
  zone: null,
  repetition: null,
  ...patch,
});

const intervals: ExecutionStep[] = [
  step(0, { kind: "warmup", durationSec: 600 }),
  step(1, {
    kind: "work",
    distanceM: 400,
    targetPace: { minSecPerKm: 240, maxSecPerKm: 250 },
    repetition: { index: 1, total: 2 },
  }),
  step(2, { kind: "recovery", durationSec: 90 }),
  step(3, {
    kind: "work",
    distanceM: 400,
    targetPace: { minSecPerKm: 240, maxSecPerKm: 250 },
    repetition: { index: 2, total: 2 },
  }),
  step(4, { kind: "cooldown", durationSec: 600 }),
];

describe("plan progress", () => {
  it("ends a time step exactly at its duration and carries the overshoot", () => {
    const plan = startPlan(intervals, 0, 0);
    expect(advancePlan(plan, 599_000, 1500)).toEqual([]);
    expect(advancePlan(plan, 601_000, 1510)).toEqual([1]);
    expect(plan.laps).toHaveLength(1);
    expect(plan.laps[0]).toMatchObject({
      index: 0,
      kind: "warmup",
      plannedSec: 600,
      actualSec: 600,
    });
    expect(plan.stepStartMs).toBe(600_000);
    expect(stepProgress(plan, 601_000, 1510)?.remainingM).toBe(400);
  });

  it("ends a distance step at its distance and judges the pace against the target", () => {
    const plan = startPlan(intervals, 0, 0);
    advancePlan(plan, 600_000, 1500);
    // 400 m in 98 s → 245 s/km, inside 240–250.
    expect(advancePlan(plan, 698_000, 1900)).toEqual([2]);
    expect(plan.laps[1]).toMatchObject({
      index: 1,
      actualM: 400,
      actualSec: 98,
      avgPaceSecPerKm: 245,
      inTarget: true,
    });
  });

  it("can pass several steps in one jump", () => {
    const short = [
      step(0, { durationSec: 60 }),
      step(1, { durationSec: 60 }),
      step(2, { durationSec: 60 }),
    ];
    const plan = startPlan(short, 0, 0);
    expect(advancePlan(plan, 130_000, 400)).toEqual([1, 2]);
    expect(plan.current).toBe(2);
    expect(plan.stepStartMs).toBe(120_000);
  });

  it("skips the running step on request and closes the last one at the finish", () => {
    const plan = startPlan(intervals, 0, 0);
    expect(skipStep(plan, 120_000, 300)).toBe(1);
    expect(plan.laps[0]).toMatchObject({ actualSec: 120, actualM: 300 });
    closePlan(plan, 150_000, 400);
    expect(plan.laps).toHaveLength(2);
    expect(plan.current).toBe(intervals.length);
    expect(stepProgress(plan, 150_000, 400)).toBeNull();
  });

  it("reports the pace against the target with a tolerance", () => {
    const target = intervals[1]!;
    expect(paceStatus(target, 244)).toBe("in");
    expect(paceStatus(target, 253)).toBe("in");
    expect(paceStatus(target, 230)).toBe("fast");
    expect(paceStatus(target, 260)).toBe("slow");
    expect(paceStatus(intervals[0]!, 300)).toBeNull();
  });
});

describe("engine with a plan", () => {
  const config = {
    environment: "treadmill" as const,
    distanceMode: "time" as const,
    strideM: 1,
    autoPause: false,
  };

  it("moves through time steps on ticks and survives a restore", () => {
    const t0 = 1_000_000;
    const engine = RecordingEngine.start(config, t0, intervals);
    engine.tick(t0 + 300_000);
    expect(engine.view(t0 + 300_000).step).toMatchObject({
      index: 0,
      remainingSec: 300,
      total: 5,
    });

    const restored = RecordingEngine.restore(
      JSON.parse(JSON.stringify(engine.state)),
    );
    restored.tick(t0 + 600_500);
    expect(restored.view(t0 + 600_500).step?.index).toBe(1);

    restored.nextStep(t0 + 601_000);
    expect(restored.view(t0 + 601_000).step?.index).toBe(2);
    restored.finish(t0 + 602_000);
    const view = restored.view(t0 + 602_000);
    expect(view.planDone).toBe(true);
    expect(restored.state.plan?.laps.map((lap) => lap.index)).toEqual([
      0, 1, 2,
    ]);
  });
});
