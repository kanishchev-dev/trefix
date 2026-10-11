import { AppState, Platform, type NativeEventSubscription } from "react-native";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { Pedometer } from "expo-sensors";

import type { ExecutionStep } from "@workspace/api-client";

import { RecordingEngine } from "./engine/recording-engine";
import { buildRecording, type SummaryEdits } from "./engine/summary";
import type { EngineConfig, EngineState, EngineView, LocationSample } from "./engine/types";
import { watchAltitude } from "./sensors/barometer";
import { learnStride } from "./sensors/stride";
import {
  appendPoints,
  createSession,
  deleteSession,
  enqueueUpload,
  loadOpenSession,
  loadPoints,
  saveSessionState,
  type SessionMeta,
  type SessionStatus,
} from "./storage/tracker-db";
import { createCueState, nextCues, type CueState } from "./voice/cues";
import { renderCue } from "./voice/phrases";
import { speak, stopSpeaking } from "./voice/speaker";

export const TRACKER_LOCATION_TASK = "trefix-tracker-location";

/** Snapshot persistence interval while recording. */
const PERSIST_EVERY_MS = 5_000;
/** A longer silence means the app was dead and nothing was recorded: the gap becomes a pause. */
const RESTORE_GAP_AS_PAUSE_MS = 30_000;
const TICK_MS = 1_000;
const METRES_PER_MILE = 1609.344;

export class TrackerPermissionError extends Error {
  constructor(readonly permission: "location" | "location_services" | "motion") {
    super(`Tracker permission missing: ${permission}`);
  }
}

export type RecorderSnapshot = {
  sessionId: string;
  config: EngineConfig;
  meta: SessionMeta;
  view: EngineView;
  /** Accepted fixes so far; the track itself is read with `getTrack()`. */
  trackSize: number;
};

/**
 * What the location service is for: the route, or only keeping the app
 * running with the screen off (time mode with voice cues) — iOS suspends an
 * app without it and Android may stop its timers.
 */
type LocationUse = "track" | "keepAlive" | "none";

type NotificationCopy = { title: string; body: string };

/**
 * The single live recording. Holds the engine, feeds it from the location
 * task, the pedometer and a 1 s tick, persists to SQLite and notifies the UI.
 * Lives outside React so background location deliveries reach it while no
 * screen is mounted.
 */
class Recorder {
  private engine: RecordingEngine | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private meta: SessionMeta = { plannedWorkoutId: null, plannedTitle: null, workoutType: null };
  private stepSubscription: ReturnType<typeof Pedometer.watchStepCount> | null = null;
  private altitudeSubscription: { remove: () => void } | null = null;
  private track: LocationSample[] = [];
  private appStateSubscription: NativeEventSubscription | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastPersistAt = 0;
  private snapshot: RecorderSnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private restoring: Promise<void> | null = null;
  private cues: CueState | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RecorderSnapshot | null => this.snapshot;

  /** Fixes of the running session, oldest first. Changes with `trackSize`. */
  getTrack(): LocationSample[] {
    return this.track;
  }

  /** Engine state for the finish screen (splits, measured distance). */
  getState(): EngineState | null {
    return this.engine?.state ?? null;
  }

  get active(): boolean {
    return this.engine !== null && this.engine.state.status !== "finished";
  }

  async start(
    userId: string,
    config: EngineConfig,
    meta: SessionMeta,
    notification: NotificationCopy,
    planSteps: ExecutionStep[] | null = null,
  ): Promise<string> {
    if (this.active) throw new Error("A recording is already running");
    const usesGps = config.distanceMode === "gps" && config.environment !== "treadmill";
    if (usesGps) await ensureLocationPermission();
    const pedometer = await preparePedometer(!usesGps);
    const keepAlive = !usesGps && Boolean(meta.voice?.enabled) && (await allowLocation(true));

    const sessionId = Crypto.randomUUID();
    const engine = RecordingEngine.start(config, Date.now(), planSteps);
    await createSession(sessionId, userId, engine.state, meta);
    this.engine = engine;
    this.sessionId = sessionId;
    this.userId = userId;
    this.meta = meta;
    this.track = [];
    this.cues = createCueState();
    await this.attachSensors(usesGps ? "track" : keepAlive ? "keepAlive" : "none", pedometer, notification);
    this.publish();
    return sessionId;
  }

  /**
   * Brings back a session after the app was restarted. When the OS kept
   * delivering fixes (Android service) the run simply continues; after a long
   * silence the gap becomes a pause the user ends with "Resume".
   */
  restore(userId: string | undefined, notification: NotificationCopy | null): Promise<void> {
    this.restoring ??= (async () => {
      if (this.engine) {
        // Woken earlier by a background fix: the UI is here now, attach the rest.
        if (notification && this.active) await this.reattach(notification);
        return;
      }
      const stored = await loadOpenSession(userId);
      if (!stored) return;
      const engine = RecordingEngine.restore(stored.state);
      this.engine = engine;
      this.sessionId = stored.id;
      this.userId = stored.userId;
      this.meta = stored.meta;
      this.track = await loadPoints(stored.id).catch(() => []);
      if (stored.status === "recording" && Date.now() - engine.state.clock > RESTORE_GAP_AS_PAUSE_MS) {
        engine.pause(engine.state.clock);
        await this.persist(true);
      }
      // Carry on talking from where the run is, without repeating the start.
      this.cues = createCueState(engine.view(Date.now()), stored.meta.voice ?? undefined, this.unitM);
      this.publish();
      if (stored.status !== "finished" && notification) await this.reattach(notification);
    })().finally(() => {
      this.restoring = null;
    });
    return this.restoring;
  }

  /** Fixes from the location task. */
  async handleLocations(locations: Location.LocationObject[]): Promise<void> {
    // The OS may wake the app only for this delivery: pick the session up from storage.
    if (!this.engine) await this.restore(undefined, null);
    const engine = this.engine;
    const sessionId = this.sessionId;
    if (!engine || !sessionId) return;
    const accepted: LocationSample[] = [];
    for (const location of locations) {
      const sample = toSample(location);
      if (engine.onLocation(sample)) accepted.push(sample);
    }
    this.track.push(...accepted);
    await appendPoints(sessionId, accepted);
    await this.persist(false);
    this.publish();
  }

  pause(): void {
    this.engine?.pause(Date.now());
    void this.persist(true);
    this.publish();
  }

  resume(): void {
    this.engine?.resume(Date.now());
    void this.persist(true);
    this.publish();
  }

  /** The runner ends the running step of the plan early. */
  nextStep(): void {
    this.engine?.nextStep(Date.now());
    void this.persist(true);
    this.publish();
  }

  async finish(): Promise<void> {
    if (!this.engine) return;
    this.engine.finish(Date.now());
    await this.detachSensors();
    await this.persist(true);
    this.publish();
  }

  /** Builds the request and queues it; the session stays on the phone until the server accepts it. */
  async save(edits: SummaryEdits, device: { appVersion?: string; model?: string }): Promise<string> {
    const engine = this.engine;
    const sessionId = this.sessionId;
    const userId = this.userId;
    if (!engine || !sessionId || !userId) throw new Error("Nothing to save");
    if (engine.state.status !== "finished") await this.finish();
    const points = await loadPoints(sessionId);
    const { summary, track } = buildRecording(sessionId, engine.state, points, edits, {
      platform: Platform.OS === "ios" ? "ios" : "android",
      osVersion: String(Platform.Version),
      appVersion: device.appVersion,
      model: device.model,
    });
    const stride = engine.calibratedStride();
    if (stride) await learnStride(stride);
    await enqueueUpload(sessionId, userId, summary, track);
    this.reset();
    return sessionId;
  }

  async discard(): Promise<void> {
    const sessionId = this.sessionId;
    stopSpeaking();
    await this.detachSensors();
    if (sessionId) await deleteSession(sessionId);
    this.reset();
  }

  /** Called by the UI clock and on app focus. */
  tick(): void {
    if (!this.engine) return;
    this.engine.tick(Date.now());
    void this.persist(false);
    this.publish();
  }

  private async reattach(notification: NotificationCopy): Promise<void> {
    const usesGps = this.engine?.state.gps !== "off";
    const keepAlive = !usesGps && Boolean(this.meta.voice?.enabled) && (await allowLocation(false));
    const pedometer = await preparePedometer(false).catch(() => false);
    await this.attachSensors(usesGps ? "track" : keepAlive ? "keepAlive" : "none", pedometer, notification).catch(
      () => undefined,
    );
  }

  private async attachSensors(location: LocationUse, pedometer: boolean, notification: NotificationCopy): Promise<void> {
    if (location !== "none" && !(await Location.hasStartedLocationUpdatesAsync(TRACKER_LOCATION_TASK))) {
      const track = location === "track";
      await Location.startLocationUpdatesAsync(TRACKER_LOCATION_TASK, {
        // Cell-level accuracy is enough to stay awake and costs almost no battery.
        accuracy: track ? Location.Accuracy.BestForNavigation : Location.Accuracy.Lowest,
        timeInterval: track ? 1000 : 30_000,
        distanceInterval: 0,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: notification.title,
          notificationBody: notification.body,
          killServiceOnDestroy: false,
        },
      });
    }
    if (pedometer && !this.stepSubscription) {
      this.stepSubscription = Pedometer.watchStepCount((result) => {
        this.engine?.onSteps(result.steps, Date.now());
        this.publish();
      });
    }
    if (this.engine?.state.config.environment !== "treadmill" && !this.altitudeSubscription) {
      this.altitudeSubscription = await watchAltitude((altM) => this.engine?.onAltitude(altM)).catch(() => null);
    }
    this.tickTimer ??= setInterval(() => this.tick(), TICK_MS);
    this.appStateSubscription ??= AppState.addEventListener("change", (state) => {
      if (state === "active") this.tick();
    });
  }

  private async detachSensors(): Promise<void> {
    this.stepSubscription?.remove();
    this.stepSubscription = null;
    this.altitudeSubscription?.remove();
    this.altitudeSubscription = null;
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    try {
      if (await Location.hasStartedLocationUpdatesAsync(TRACKER_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(TRACKER_LOCATION_TASK);
      }
    } catch {
      // Not started or already stopped.
    }
  }

  private async persist(force: boolean): Promise<void> {
    const engine = this.engine;
    const sessionId = this.sessionId;
    if (!engine || !sessionId) return;
    const now = Date.now();
    if (!force && now - this.lastPersistAt < PERSIST_EVERY_MS) return;
    this.lastPersistAt = now;
    await saveSessionState(sessionId, engine.state.status as SessionStatus, engine.state);
  }

  private publish(): void {
    this.snapshot =
      this.engine && this.sessionId
        ? {
            sessionId: this.sessionId,
            config: this.engine.state.config,
            meta: this.meta,
            view: this.engine.view(Date.now()),
            trackSize: this.track.length,
          }
        : null;
    if (this.snapshot) this.say(this.snapshot.view);
    for (const listener of this.listeners) listener();
  }

  private get unitM(): number {
    return this.meta.voice?.units === "imperial" ? METRES_PER_MILE : 1000;
  }

  private say(view: EngineView): void {
    const voice = this.meta.voice;
    if (!voice?.enabled || !this.cues) return;
    for (const cue of nextCues(this.cues, view, Date.now(), voice, this.unitM)) {
      speak(renderCue(cue, voice.language, voice.units), voice.language);
    }
  }

  private reset(): void {
    this.engine = null;
    this.sessionId = null;
    this.meta = { plannedWorkoutId: null, plannedTitle: null, workoutType: null };
    this.cues = null;
    this.track = [];
    this.publish();
  }
}

export const recorder = new Recorder();

async function ensureLocationPermission(): Promise<void> {
  if (!(await Location.hasServicesEnabledAsync())) throw new TrackerPermissionError("location_services");
  const current = await Location.getForegroundPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
  if (!granted) throw new TrackerPermissionError("location");
}

/**
 * Location access for keeping the app awake; never fails the start. `ask`
 * shows the system prompt when it may still be shown.
 */
async function allowLocation(ask: boolean): Promise<boolean> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return false;
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return true;
    return ask && current.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** True when steps can be counted. Required for runs without GPS. */
async function preparePedometer(required: boolean): Promise<boolean> {
  const available = await Pedometer.isAvailableAsync().catch(() => false);
  if (!available) {
    if (required) throw new TrackerPermissionError("motion");
    return false;
  }
  const current = await Pedometer.getPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await Pedometer.requestPermissionsAsync()).granted);
  if (!granted && required) throw new TrackerPermissionError("motion");
  return granted;
}

function toSample(location: Location.LocationObject): LocationSample {
  const { coords } = location;
  return {
    t: location.timestamp,
    lat: coords.latitude,
    lng: coords.longitude,
    alt: coords.altitude ?? null,
    acc: coords.accuracy ?? null,
    speed: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
  };
}
