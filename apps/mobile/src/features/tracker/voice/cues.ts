import type { ExecutionStep } from "@trefix/api-client";

import type { PaceStatus } from "../engine/plan-progress";
import type { EngineView } from "../engine/types";

export type VoiceInterval = "1u" | "2u" | "5min" | "10min";

/** What the regular report says, and whether plan steps are announced. */
export type VoiceReport = {
  distance: boolean;
  time: boolean;
  /** Pace of the last kilometre (mile) or interval. */
  splitPace: boolean;
  avgPace: boolean;
  planSteps: boolean;
};

export type VoiceSettings = {
  enabled: boolean;
  /** Distance report every 1 or 2 units (km or miles), or a time report every 5 or 10 minutes. */
  interval: VoiceInterval;
  /** Absent in settings and sessions of older builds: everything is said. */
  report?: VoiceReport;
};

export const DEFAULT_VOICE_REPORT: VoiceReport = {
  distance: true,
  time: true,
  splitPace: true,
  avgPace: false,
  planSteps: true,
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  interval: "1u",
  report: DEFAULT_VOICE_REPORT,
};

const PLAN_CUES: ReadonlySet<Cue["type"]> = new Set([
  "step",
  "stepEnding",
  "pace",
  "planDone",
]);

/** Drops the plan announcements the runner turned off. */
export function reportedCues(
  cues: Cue[],
  report: VoiceReport | undefined,
): Cue[] {
  if (!report || report.planSteps) return cues;
  return cues.filter((cue) => !PLAN_CUES.has(cue.type));
}

/** Rules of the voice; tuned on real runs. */
export const CUE_RULES = {
  /** Off the target pace for this long before saying so. */
  offTargetMs: 20_000,
  /** At most one pace remark per this interval. */
  paceRepeatMs: 60_000,
  /** Countdown before the end of a time step. */
  countdownSec: 10,
  /** Steps shorter than this get no countdown. */
  countdownMinStepSec: 30,
  /** Warning before the end of a distance step. */
  countdownM: 100,
  countdownMinStepM: 400,
} as const;

export type Cue =
  | { type: "started" }
  | {
      type: "interval";
      distanceM: number;
      movingMs: number;
      avgPaceSecPerKm: number | null;
      segmentPaceSecPerKm: number | null;
    }
  | { type: "step"; step: ExecutionStep; index: number; total: number }
  | {
      type: "stepEnding";
      remainingSec: number | null;
      remainingM: number | null;
      next: ExecutionStep | null;
    }
  | { type: "pace"; status: Exclude<PaceStatus, "in">; targetSecPerKm: number }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "autoPaused" }
  | { type: "planDone" }
  | { type: "gpsLost" }
  | { type: "gpsBack" }
  | {
      type: "finished";
      distanceM: number;
      movingMs: number;
      avgPaceSecPerKm: number | null;
    };

/** What the voice remembers between views; plain object, rebuilt on restore. */
export type CueState = {
  prev: EngineView | null;
  /** Interval marks passed and where the last one was. */
  mark: number;
  markAt: { movingMs: number; distanceM: number };
  offTarget: { status: Exclude<PaceStatus, "in">; since: number } | null;
  lastPaceCueAt: number | null;
  /** Step index the countdown was said for. */
  countdownFor: number | null;
};

/**
 * With a `view` the recording continues after an app restart: no start
 * announcement, interval marks pick up from the current numbers.
 */
export function createCueState(
  view: EngineView | null = null,
  settings?: VoiceSettings,
  unitM = 1000,
): CueState {
  return {
    prev: view,
    mark: view && settings ? markOf(view, settings, unitM) : 0,
    markAt: { movingMs: view?.movingMs ?? 0, distanceM: view?.distanceM ?? 0 },
    offTarget: null,
    lastPaceCueAt: null,
    // Already inside the ending window: the countdown would be late.
    countdownFor:
      view?.step && inEndingWindow(view.step) ? view.step.index : null,
  };
}

function inEndingWindow(step: NonNullable<EngineView["step"]>): boolean {
  return (
    (step.remainingSec !== null &&
      step.remainingSec <= CUE_RULES.countdownSec) ||
    (step.remainingM !== null && step.remainingM <= CUE_RULES.countdownM)
  );
}

function markOf(
  view: EngineView,
  settings: VoiceSettings,
  unitM: number,
): number {
  switch (settings.interval) {
    case "1u":
      return Math.floor(view.distanceM / unitM);
    case "2u":
      return Math.floor(view.distanceM / (2 * unitM));
    case "5min":
      return Math.floor(view.movingMs / 300_000);
    case "10min":
      return Math.floor(view.movingMs / 600_000);
  }
}

const paceOf = (ms: number, metres: number): number | null =>
  metres >= 50 ? Math.round(ms / metres) : null;

/**
 * Compares the new view with the previous one and returns what to say.
 * Pure: `state` is updated in place, nothing is spoken here.
 */
export function nextCues(
  state: CueState,
  view: EngineView,
  now: number,
  settings: VoiceSettings,
  unitM = 1000,
): Cue[] {
  const prev = state.prev;
  state.prev = view;
  const cues: Cue[] = [];

  if (!prev) {
    cues.push({ type: "started" });
    if (view.step) {
      cues.push({
        type: "step",
        step: view.step.step,
        index: view.step.index,
        total: view.step.total,
      });
    }
    return cues;
  }

  if (view.status === "finished") {
    if (prev.status !== "finished") {
      cues.push({
        type: "finished",
        distanceM: view.distanceM,
        movingMs: view.movingMs,
        avgPaceSecPerKm: view.avgPaceSecPerKm,
      });
    }
    return cues;
  }

  if (prev.status === "recording" && view.status === "paused")
    cues.push({ type: "paused" });
  else if (prev.status === "paused" && view.status === "recording")
    cues.push({ type: "resumed" });
  else if (!prev.autoPaused && view.autoPaused)
    cues.push({ type: "autoPaused" });
  else if (prev.autoPaused && !view.autoPaused && view.status === "recording")
    cues.push({ type: "resumed" });

  if (prev.gps === "good" && view.gps === "lost")
    cues.push({ type: "gpsLost" });
  else if (prev.gps === "lost" && view.gps === "good")
    cues.push({ type: "gpsBack" });

  // Plan: a new step, its end approaching, the plan done.
  const step = view.step;
  if (step && step.index !== prev.step?.index) {
    cues.push({
      type: "step",
      step: step.step,
      index: step.index,
      total: step.total,
    });
    state.offTarget = null;
  } else if (step && state.countdownFor !== step.index) {
    const { durationSec, distanceM } = step.step;
    const timeEnding =
      durationSec !== null &&
      durationSec >= CUE_RULES.countdownMinStepSec &&
      step.remainingSec !== null &&
      step.remainingSec <= CUE_RULES.countdownSec &&
      step.remainingSec > 0;
    const distanceEnding =
      distanceM !== null &&
      distanceM >= CUE_RULES.countdownMinStepM &&
      step.remainingM !== null &&
      step.remainingM <= CUE_RULES.countdownM &&
      step.remainingM > 0;
    if (timeEnding || distanceEnding) {
      state.countdownFor = step.index;
      cues.push({
        type: "stepEnding",
        remainingSec: timeEnding ? CUE_RULES.countdownSec : null,
        remainingM: distanceEnding ? CUE_RULES.countdownM : null,
        next: step.next,
      });
    }
  }
  if (view.planDone && !prev.planDone) cues.push({ type: "planDone" });

  // Pace against the target of the step.
  const status = view.paceStatus;
  const target = step?.step.targetPace;
  if (status && status !== "in" && target) {
    if (state.offTarget?.status !== status)
      state.offTarget = { status, since: now };
    const longEnough = now - state.offTarget.since >= CUE_RULES.offTargetMs;
    const quiet =
      state.lastPaceCueAt === null ||
      now - state.lastPaceCueAt >= CUE_RULES.paceRepeatMs;
    if (longEnough && quiet) {
      state.lastPaceCueAt = now;
      cues.push({
        type: "pace",
        status,
        targetSecPerKm:
          status === "fast" ? target.minSecPerKm : target.maxSecPerKm,
      });
    }
  } else {
    state.offTarget = null;
  }

  // Regular report by distance or time.
  const mark = markOf(view, settings, unitM);
  if (mark > state.mark) {
    cues.push({
      type: "interval",
      distanceM: view.distanceM,
      movingMs: view.movingMs,
      avgPaceSecPerKm: view.avgPaceSecPerKm,
      segmentPaceSecPerKm: paceOf(
        view.movingMs - state.markAt.movingMs,
        view.distanceM - state.markAt.distanceM,
      ),
    });
    state.mark = mark;
    state.markAt = { movingMs: view.movingMs, distanceM: view.distanceM };
  }

  return cues;
}
