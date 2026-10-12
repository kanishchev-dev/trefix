import type { ExecutionStep } from "@trefix/api-client";

import { haversineM } from "./geo";
import {
  advancePlan,
  closePlan,
  paceStatus,
  skipStep,
  startPlan,
  stepProgress,
} from "./plan-progress";
import type {
  EngineConfig,
  EngineState,
  EngineView,
  LocationSample,
  TimelineSample,
} from "./types";

export const ENGINE_RULES = {
  /** A fix worse than this does not move the track. */
  goodAccuracyM: 30,
  /** No good fix for this long: the pedometer takes over. */
  lostAfterMs: 15_000,
  /** Faster than this between fixes is a GPS jump, not running. */
  maxSpeedMps: 8,
  /** Smaller moves are jitter; they accumulate until the runner is this far. */
  minMoveM: 2,
  autoPause: {
    outdoor: { pauseBelowMps: 0.7, resumeAboveMps: 1.2, pauseAfterMs: 5_000 },
    trail: { pauseBelowMps: 0.4, resumeAboveMps: 0.8, pauseAfterMs: 8_000 },
    /** Pedometer only: no steps for this long. */
    stepsPauseAfterMs: 5_000,
  },
  paceWindowMs: 20_000,
  cadenceWindowMs: 15_000,
  timelineEveryM: 5,
  timelineEveryMs: 5_000,
  elevationHysteresisM: 3,
} as const;

/**
 * The recording state machine. Pure: it only consumes time-stamped events
 * (fixes, step counts, ticks, buttons), so it can be replayed in tests and
 * restored from a JSON snapshot after the app was killed. Time never comes
 * from timers — only from event stamps.
 */
export class RecordingEngine {
  private constructor(public state: EngineState) {}

  static start(
    config: EngineConfig,
    t: number,
    planSteps: ExecutionStep[] | null = null,
  ): RecordingEngine {
    const usesGps =
      config.distanceMode === "gps" && config.environment !== "treadmill";
    return new RecordingEngine({
      version: 1,
      config,
      status: "recording",
      autoPaused: false,
      startedAt: t,
      endedAt: null,
      clock: t,
      movingMs: 0,
      distanceM: 0,
      gpsDistanceM: 0,
      pedometerDistanceM: 0,
      gps: usesGps ? "searching" : "off",
      lastFix: null,
      badSince: null,
      lastLocationAt: null,
      slowSince: null,
      steps: 0,
      lastStepTotal: null,
      lastStepAt: null,
      stepWindow: [],
      pauses: [],
      elevation: { gainM: 0, lossM: 0, refM: null },
      timeline: [[0, 0, 0]],
      calibration: { steps: 0, meters: 0 },
      resumedAt: t,
      plan:
        planSteps && planSteps.length > 0 ? startPlan(planSteps, 0, 0) : null,
    });
  }

  static restore(state: EngineState): RecordingEngine {
    return new RecordingEngine({
      ...state,
      plan: state.plan ?? null,
      lastStepTotal: null,
      stepWindow: [],
    });
  }

  /** The runner ends the running step early. */
  nextStep(t: number): void {
    const s = this.state;
    if (!s.plan || s.status === "finished") return;
    this.advance(t);
    skipStep(s.plan, s.movingMs, s.distanceM);
  }

  get usesGps(): boolean {
    return this.state.gps !== "off";
  }

  /** The pedometer counts distance: no GPS by choice, a treadmill, or no good fix right now. */
  get onPedometer(): boolean {
    return this.state.gps !== "good";
  }

  private get moving(): boolean {
    return this.state.status === "recording" && !this.state.autoPaused;
  }

  /** Altitude from the barometer, metres; only its changes matter. */
  onAltitude(altM: number): void {
    const s = this.state;
    if (s.status !== "recording" || s.autoPaused || !Number.isFinite(altM))
      return;
    if (s.elevation.source !== "baro") {
      // A new reference: barometric and GPS altitudes have different zeros.
      s.elevation.source = "baro";
      s.elevation.refM = null;
    }
    this.trackElevation(altM, "baro");
  }

  /** Accepts a fix; returns true when it became part of the track. */
  onLocation(sample: LocationSample): boolean {
    const s = this.state;
    if (!this.usesGps || s.status === "finished") return false;
    this.advance(sample.t);
    s.lastLocationAt = sample.t;

    const good =
      sample.acc !== null && sample.acc <= ENGINE_RULES.goodAccuracyM;
    if (!good) {
      s.badSince ??= sample.t;
      if (sample.t - s.badSince >= ENGINE_RULES.lostAfterMs && s.gps === "good")
        s.gps = "lost";
      return false;
    }
    s.badSince = null;
    const recovering = s.gps !== "good";
    s.gps = "good";

    // The first fix, or the first one after a gap: the pedometer covered the stretch.
    if (!s.lastFix || recovering || s.status !== "recording") {
      s.lastFix = sample;
      this.trackElevation(sample.alt, "gps");
      return true;
    }

    const dt = (sample.t - s.lastFix.t) / 1000;
    if (dt <= 0) return false;
    const d = haversineM(s.lastFix, sample);
    const computedSpeed = d / dt;
    if (computedSpeed > ENGINE_RULES.maxSpeedMps) return false;

    const speed =
      sample.speed !== null && sample.speed >= 0 ? sample.speed : computedSpeed;
    this.autoPauseBySpeed(speed, sample.t);
    if (d < ENGINE_RULES.minMoveM) return false;

    s.lastFix = sample;
    this.trackElevation(sample.alt, "gps");
    if (this.moving) {
      this.addDistance(d, "gps");
      if (s.lastStepTotal !== null) s.calibration.meters += d;
    }
    return true;
  }

  /** `total` is the step count since the pedometer subscription started. */
  onSteps(total: number, t: number): void {
    const s = this.state;
    if (s.status === "finished") return;
    this.advance(t);
    if (s.lastStepTotal === null || total < s.lastStepTotal) {
      s.lastStepTotal = total;
      return;
    }
    const delta = total - s.lastStepTotal;
    s.lastStepTotal = total;
    if (delta <= 0) return;

    s.steps += delta;
    s.lastStepAt = t;
    s.stepWindow.push([t, delta]);
    s.stepWindow = s.stepWindow.filter(
      ([at]) => t - at <= ENGINE_RULES.cadenceWindowMs,
    );

    if (this.onPedometer && s.autoPaused && s.config.autoPause)
      this.autoResume(t);
    if (!this.moving) return;
    if (this.onPedometer) {
      this.addDistance(delta * s.config.strideM, "pedometer");
    } else if (s.gps === "good") {
      s.calibration.steps += delta;
    }
  }

  /** Called about once a second and on every event: detects lost GPS and step-based auto-pause. */
  tick(t: number): void {
    const s = this.state;
    if (s.status === "finished") return;
    this.advance(t);
    if (
      s.gps === "good" &&
      s.lastLocationAt !== null &&
      t - s.lastLocationAt >= ENGINE_RULES.lostAfterMs
    ) {
      s.gps = "lost";
    }
    if (this.onPedometer && s.config.autoPause && this.moving) {
      const since = Math.max(s.lastStepAt ?? s.resumedAt, s.resumedAt);
      if (t - since >= ENGINE_RULES.autoPause.stepsPauseAfterMs)
        this.autoPause(since, t);
    }
  }

  pause(t: number): void {
    const s = this.state;
    if (s.status !== "recording") return;
    this.advance(t);
    if (s.autoPaused) {
      s.autoPaused = false;
      this.closePause(t);
    }
    s.status = "paused";
    s.pauses.push({ startedAt: t, endedAt: null, auto: false });
  }

  resume(t: number): void {
    const s = this.state;
    if (s.status !== "paused") return;
    this.advance(t);
    this.closePause(t);
    s.status = "recording";
    s.resumedAt = t;
    s.slowSince = null;
    // The runner may have moved while paused: start the track anew from the next fix.
    if (s.gps === "good") s.gps = "searching";
  }

  finish(t: number): void {
    const s = this.state;
    if (s.status === "finished") return;
    this.advance(t);
    this.closePause(t);
    s.autoPaused = false;
    s.status = "finished";
    s.endedAt = t;
    this.pushTimeline(true);
    if (s.plan) closePlan(s.plan, s.movingMs, s.distanceM);
  }

  view(now: number): EngineView {
    const s = this.state;
    const at = s.endedAt ?? Math.max(now, s.clock);
    const movingMs = s.movingMs + (this.moving ? Math.max(0, at - s.clock) : 0);
    const currentPace = this.currentPace();
    const step = s.plan ? stepProgress(s.plan, movingMs, s.distanceM) : null;
    return {
      status: s.status,
      autoPaused: s.autoPaused,
      elapsedMs: at - s.startedAt,
      movingMs,
      distanceM: s.distanceM,
      currentPaceSecPerKm: currentPace,
      avgPaceSecPerKm: s.distanceM >= 50 ? movingMs / s.distanceM : null,
      gps: s.gps,
      onPedometer: this.onPedometer,
      elevationGainM: s.elevation.gainM,
      cadence: this.cadence(at),
      km: Math.floor(s.distanceM / 1000),
      step,
      planDone: s.plan !== null && s.plan.current >= s.plan.steps.length,
      paceStatus:
        step && !s.autoPaused && s.status === "recording"
          ? paceStatus(step.step, currentPace)
          : null,
    };
  }

  /** Learned metres per step, when the run had enough GPS running with steps. */
  calibratedStride(): number | null {
    const { steps, meters } = this.state.calibration;
    if (steps < 500 || meters < 300) return null;
    const stride = meters / steps;
    return stride >= 0.4 && stride <= 2.5 ? stride : null;
  }

  private advance(t: number): void {
    const s = this.state;
    if (t <= s.clock) return;
    if (this.moving) s.movingMs += t - s.clock;
    s.clock = t;
    this.syncPlan();
  }

  private syncPlan(): void {
    const s = this.state;
    if (s.plan) advancePlan(s.plan, s.movingMs, s.distanceM);
  }

  private addDistance(d: number, source: "gps" | "pedometer"): void {
    const s = this.state;
    s.distanceM += d;
    if (source === "gps") s.gpsDistanceM += d;
    else s.pedometerDistanceM += d;
    this.pushTimeline(false);
    this.syncPlan();
  }

  private pushTimeline(force: boolean): void {
    const s = this.state;
    const last = s.timeline[s.timeline.length - 1]!;
    const sample: TimelineSample = [s.movingMs, s.distanceM, s.elevation.gainM];
    if (
      force ||
      sample[1] - last[1] >= ENGINE_RULES.timelineEveryM ||
      sample[0] - last[0] >= ENGINE_RULES.timelineEveryMs
    ) {
      if (sample[0] !== last[0] || sample[1] !== last[1])
        s.timeline.push(sample);
    }
  }

  private autoPauseBySpeed(speed: number, t: number): void {
    const s = this.state;
    if (!s.config.autoPause || s.status !== "recording") return;
    const rules =
      s.config.environment === "trail"
        ? ENGINE_RULES.autoPause.trail
        : ENGINE_RULES.autoPause.outdoor;
    if (s.autoPaused) {
      if (speed > rules.resumeAboveMps) this.autoResume(t);
      return;
    }
    if (speed >= rules.pauseBelowMps) {
      s.slowSince = null;
      return;
    }
    s.slowSince ??= t;
    if (t - s.slowSince >= rules.pauseAfterMs) this.autoPause(s.slowSince, t);
  }

  /** The pause starts when the runner stopped, not when it was detected: that time is taken back. */
  private autoPause(stoppedAt: number, t: number): void {
    const s = this.state;
    s.movingMs = Math.max(0, s.movingMs - Math.max(0, t - stoppedAt));
    s.autoPaused = true;
    s.slowSince = null;
    s.pauses.push({ startedAt: stoppedAt, endedAt: null, auto: true });
  }

  private autoResume(t: number): void {
    const s = this.state;
    s.autoPaused = false;
    s.resumedAt = t;
    this.closePause(t);
  }

  private closePause(t: number): void {
    const last = this.state.pauses[this.state.pauses.length - 1];
    if (last && last.endedAt === null) last.endedAt = t;
  }

  private trackElevation(alt: number | null, source: "gps" | "baro"): void {
    if (alt === null || !Number.isFinite(alt)) return;
    const e = this.state.elevation;
    // Once the barometer speaks, GPS altitude (±10 m noise) is ignored.
    if (source === "gps" && e.source === "baro") return;
    if (e.refM === null) {
      e.refM = alt;
      return;
    }
    const diff = alt - e.refM;
    if (diff >= ENGINE_RULES.elevationHysteresisM) {
      e.gainM += diff;
      e.refM = alt;
    } else if (diff <= -ENGINE_RULES.elevationHysteresisM) {
      e.lossM -= diff;
      e.refM = alt;
    }
  }

  private currentPace(): number | null {
    const timeline = this.state.timeline;
    const last = timeline[timeline.length - 1];
    if (!last || this.state.autoPaused) return null;
    for (let i = timeline.length - 2; i >= 0; i -= 1) {
      const sample = timeline[i]!;
      const dt = last[0] - sample[0];
      if (dt >= ENGINE_RULES.paceWindowMs) {
        const dd = last[1] - sample[1];
        return dd >= 10 ? dt / dd : null;
      }
    }
    return null;
  }

  private cadence(now: number): number | null {
    const recent = this.state.stepWindow.filter(
      ([at]) => now - at <= ENGINE_RULES.cadenceWindowMs,
    );
    if (recent.length < 2) return null;
    const steps = recent.slice(1).reduce((sum, [, delta]) => sum + delta, 0);
    const spanMs = recent[recent.length - 1]![0] - recent[0]![0];
    return spanMs >= 3_000 ? Math.round((steps / spanMs) * 60_000) : null;
  }
}
