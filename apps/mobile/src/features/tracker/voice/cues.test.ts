import { describe, expect, it } from "vitest";

import type { ExecutionStep } from "@workspace/api-client";

import type { StepProgress } from "../engine/plan-progress";
import type { EngineView } from "../engine/types";
import { createCueState, nextCues, type Cue, type VoiceSettings } from "./cues";
import { renderCue, speakDuration, speakPace } from "./phrases";

const settings: VoiceSettings = { enabled: true, interval: "1u" };

const baseView: EngineView = {
  status: "recording",
  autoPaused: false,
  elapsedMs: 0,
  movingMs: 0,
  distanceM: 0,
  currentPaceSecPerKm: null,
  avgPaceSecPerKm: null,
  gps: "good",
  onPedometer: false,
  elevationGainM: 0,
  cadence: null,
  km: 0,
  step: null,
  planDone: false,
  paceStatus: null,
};

const view = (patch: Partial<EngineView>): EngineView => ({
  ...baseView,
  ...patch,
});

const work: ExecutionStep = {
  index: 1,
  kind: "work",
  durationSec: 120,
  distanceM: null,
  targetPace: { minSecPerKm: 240, maxSecPerKm: 250 },
  zone: null,
  repetition: { index: 1, total: 4 },
};
const recovery: ExecutionStep = {
  ...work,
  index: 2,
  kind: "recovery",
  durationSec: 90,
  targetPace: null,
  repetition: null,
};

const progress = (step: ExecutionStep, remainingSec: number): StepProgress => ({
  step,
  index: step.index,
  total: 8,
  remainingSec,
  remainingM: null,
  fraction: 0,
  next: recovery,
});

const types = (cues: Cue[]): string[] => cues.map((cue) => cue.type);

describe("voice cues", () => {
  it("announces the start and the first step", () => {
    const state = createCueState();
    expect(
      types(nextCues(state, view({ step: progress(work, 120) }), 0, settings)),
    ).toEqual(["started", "step"]);
  });

  it("reports every kilometre with the pace of that kilometre", () => {
    const state = createCueState();
    nextCues(state, view({}), 0, settings);
    expect(
      nextCues(state, view({ distanceM: 990, movingMs: 297_000 }), 1, settings),
    ).toEqual([]);
    const [cue] = nextCues(
      state,
      view({ distanceM: 1004, movingMs: 301_000, avgPaceSecPerKm: 300 }),
      2,
      settings,
    );
    expect(cue).toMatchObject({ type: "interval", segmentPaceSecPerKm: 300 });
    expect(
      nextCues(
        state,
        view({ distanceM: 1500, movingMs: 450_000 }),
        3,
        settings,
      ),
    ).toEqual([]);
  });

  it("reports by time and does not repeat old marks after a restore", () => {
    const every5 = { enabled: true, interval: "5min" as const };
    const state = createCueState(
      view({ movingMs: 610_000, distanceM: 2000 }),
      every5,
    );
    expect(
      nextCues(state, view({ movingMs: 611_000, distanceM: 2003 }), 0, every5),
    ).toEqual([]);
    expect(
      types(
        nextCues(
          state,
          view({ movingMs: 900_000, distanceM: 3000 }),
          1,
          every5,
        ),
      ),
    ).toEqual(["interval"]);
  });

  it("counts down the end of a step once and names the next one", () => {
    const state = createCueState(view({ step: progress(work, 30) }));
    expect(
      nextCues(state, view({ step: progress(work, 11) }), 0, settings),
    ).toEqual([]);
    expect(
      nextCues(state, view({ step: progress(work, 10) }), 1, settings),
    ).toEqual([
      {
        type: "stepEnding",
        remainingSec: 10,
        remainingM: null,
        next: recovery,
      },
    ]);
    expect(
      nextCues(state, view({ step: progress(work, 9) }), 2, settings),
    ).toEqual([]);
    expect(
      types(
        nextCues(state, view({ step: progress(recovery, 90) }), 3, settings),
      ),
    ).toEqual(["step"]);
  });

  it("says the pace is off only after 20 s and not more than once a minute", () => {
    const state = createCueState(view({ step: progress(work, 120) }));
    const fast = view({ step: progress(work, 100), paceStatus: "fast" });
    expect(nextCues(state, fast, 0, settings)).toEqual([]);
    expect(nextCues(state, fast, 19_000, settings)).toEqual([]);
    expect(nextCues(state, fast, 20_000, settings)).toEqual([
      { type: "pace", status: "fast", targetSecPerKm: 240 },
    ]);
    expect(nextCues(state, fast, 50_000, settings)).toEqual([]);
    expect(types(nextCues(state, fast, 80_000, settings))).toEqual(["pace"]);
    // Back on target resets the timer.
    nextCues(
      state,
      view({ step: progress(work, 60), paceStatus: "in" }),
      81_000,
      settings,
    );
    expect(
      nextCues(
        state,
        view({ step: progress(work, 50), paceStatus: "slow" }),
        145_000,
        settings,
      ),
    ).toEqual([]);
  });

  it("follows pauses, GPS and the end of the plan and the run", () => {
    const state = createCueState(view({}));
    expect(
      types(nextCues(state, view({ status: "paused" }), 0, settings)),
    ).toEqual(["paused"]);
    expect(types(nextCues(state, view({}), 1, settings))).toEqual(["resumed"]);
    expect(
      types(nextCues(state, view({ autoPaused: true }), 2, settings)),
    ).toEqual(["autoPaused"]);
    expect(types(nextCues(state, view({}), 3, settings))).toEqual(["resumed"]);
    expect(types(nextCues(state, view({ gps: "lost" }), 4, settings))).toEqual([
      "gpsLost",
    ]);
    expect(types(nextCues(state, view({ gps: "good" }), 5, settings))).toEqual([
      "gpsBack",
    ]);
    expect(
      types(nextCues(state, view({ planDone: true }), 6, settings)),
    ).toEqual(["planDone"]);
    expect(
      types(
        nextCues(
          state,
          view({ status: "finished", planDone: true }),
          7,
          settings,
        ),
      ),
    ).toEqual(["finished"]);
  });
});

describe("phrases", () => {
  it("uses Russian plural forms", () => {
    expect(speakDuration(61, "ru")).toBe("1 минута 1 секунда");
    expect(speakDuration(22 * 60 + 3, "ru")).toBe("22 минуты 3 секунды");
    expect(speakDuration(3600 + 5 * 60 + 12, "ru")).toBe("1 час 5 минут");
    expect(speakPace(312, "ru", "metric")).toBe(
      "5 минут 12 секунд на километр",
    );
  });

  it("renders cues in both languages and units", () => {
    expect(
      renderCue(
        {
          type: "interval",
          distanceM: 2004,
          movingMs: 610_000,
          avgPaceSecPerKm: 305,
          segmentPaceSecPerKm: 300,
        },
        "ru",
        "metric",
      ),
    ).toBe(
      "2 километра. Время 10 минут 10 секунд. Темп отрезка 5 минут на километр. Средний темп 5 минут 5 секунд на километр.",
    );
    expect(
      renderCue(
        { type: "step", step: work, index: 1, total: 8 },
        "ru",
        "metric",
      ),
    ).toBe(
      "Рабочий отрезок, повтор 1 из 4. 2 минуты. Целевой темп 4 минуты 5 секунд на километр.",
    );
    expect(
      renderCue(
        {
          type: "stepEnding",
          remainingSec: 10,
          remainingM: null,
          next: recovery,
        },
        "en",
        "metric",
      ),
    ).toBe("Remaining 10 seconds. Next: recovery.");
    expect(
      renderCue(
        {
          type: "finished",
          distanceM: 5230,
          movingMs: 1_800_000,
          avgPaceSecPerKm: null,
        },
        "en",
        "imperial",
      ),
    ).toBe("Workout finished. 3.2 miles in 30 minutes.");
  });
});
