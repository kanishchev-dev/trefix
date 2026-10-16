import * as SQLite from "expo-sqlite";
import type { RecordedActivityRequest, WorkoutType } from "@trefix/api-client";

import type { EngineState, LocationSample } from "../engine/types";
import type { TrackFile } from "../engine/summary";
import type { VoiceSettings } from "../voice/cues";
import type { VoiceLanguage, VoiceUnits } from "../voice/phrases";

/**
 * Everything of a recording lives on the phone until the server confirms it:
 * the engine snapshot, every accepted fix and the queued upload. Writes go to
 * SQLite right away, so a killed app loses at most the last few seconds.
 */
const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  state TEXT NOT NULL,
  meta TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS points (
  session_id TEXT NOT NULL,
  t INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  alt REAL,
  acc REAL,
  speed REAL
);
CREATE INDEX IF NOT EXISTS points_session_t ON points (session_id, t);
CREATE TABLE IF NOT EXISTS uploads (
  session_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  track TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL
);
`;

/** `saving` — finished and queued for upload; the session row stays until the server accepts it. */
export type SessionStatus = "recording" | "paused" | "finished" | "saving";

/** What the setup screen chose, kept with the session. */
export type SessionMeta = {
  plannedWorkoutId: string | null;
  plannedTitle: string | null;
  /** Type picked for a free run; the finish screen starts from it. */
  workoutType: Exclude<WorkoutType, "rest"> | null;
  /** Voice cues of this run; absent in sessions of older builds. */
  voice?: SessionVoice | null;
  /**
   * The run goes towards one goal (a workout added with a goal, or a free run
   * with a goal set before the start) rather than through plan steps.
   */
  goal?: RunGoal | null;
};

export type RunGoal = {
  kind: "duration" | "distance";
  durationSec: number | null;
  distanceM: number | null;
  /** Distance goal: finish within this many seconds. */
  timeLimitSec: number | null;
};

export type SessionVoice = VoiceSettings & {
  language: VoiceLanguage;
  units: VoiceUnits;
};

export type StoredSession = {
  id: string;
  userId: string;
  status: SessionStatus;
  state: EngineState;
  meta: SessionMeta;
  createdAt: number;
};

export type StoredUpload = {
  sessionId: string;
  userId: string;
  summary: RecordedActivityRequest;
  track: TrackFile | null;
  attempts: number;
  lastError: string | null;
};

let database: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    database = SQLite.openDatabaseAsync("tracker.db").then(async (opened) => {
      await opened.execAsync(SCHEMA);
      return opened;
    });
  }
  return database;
}

type SessionRow = {
  id: string;
  user_id: string;
  status: SessionStatus;
  state: string;
  meta: string;
  created_at: number;
};

const toSession = (row: SessionRow): StoredSession => ({
  id: row.id,
  userId: row.user_id,
  status: row.status,
  state: JSON.parse(row.state) as EngineState,
  meta: JSON.parse(row.meta) as SessionMeta,
  createdAt: row.created_at,
});

export async function createSession(
  id: string,
  userId: string,
  state: EngineState,
  meta: SessionMeta,
): Promise<void> {
  const now = Date.now();
  await (
    await db()
  ).runAsync(
    "INSERT INTO sessions (id, user_id, status, state, meta, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    userId,
    state.status,
    JSON.stringify(state),
    JSON.stringify(meta),
    now,
    now,
  );
}

export async function saveSessionState(
  id: string,
  status: SessionStatus,
  state: EngineState,
): Promise<void> {
  await (
    await db()
  ).runAsync(
    "UPDATE sessions SET status = ?, state = ?, updated_at = ? WHERE id = ?",
    status,
    JSON.stringify(state),
    Date.now(),
    id,
  );
}

export async function saveSessionMeta(
  id: string,
  meta: SessionMeta,
): Promise<void> {
  await (
    await db()
  ).runAsync(
    "UPDATE sessions SET meta = ?, updated_at = ? WHERE id = ?",
    JSON.stringify(meta),
    Date.now(),
    id,
  );
}

/**
 * The session being recorded or waiting for the finish screen, if any.
 * Without a user — any user's: the OS can wake the app for a fix before anyone is signed in to the UI.
 */
export async function loadOpenSession(
  userId?: string,
): Promise<StoredSession | null> {
  const database = await db();
  const row = userId
    ? await database.getFirstAsync<SessionRow>(
        "SELECT * FROM sessions WHERE user_id = ? AND status IN ('recording', 'paused', 'finished') ORDER BY created_at DESC LIMIT 1",
        userId,
      )
    : await database.getFirstAsync<SessionRow>(
        "SELECT * FROM sessions WHERE status IN ('recording', 'paused', 'finished') ORDER BY created_at DESC LIMIT 1",
      );
  return row ? toSession(row) : null;
}

export async function loadSession(id: string): Promise<StoredSession | null> {
  const row = await (
    await db()
  ).getFirstAsync<SessionRow>("SELECT * FROM sessions WHERE id = ?", id);
  return row ? toSession(row) : null;
}

export async function appendPoints(
  sessionId: string,
  samples: LocationSample[],
): Promise<void> {
  if (samples.length === 0) return;
  const database = await db();
  await database.withTransactionAsync(async () => {
    for (const sample of samples) {
      await database.runAsync(
        "INSERT INTO points (session_id, t, lat, lng, alt, acc, speed) VALUES (?, ?, ?, ?, ?, ?, ?)",
        sessionId,
        sample.t,
        sample.lat,
        sample.lng,
        sample.alt,
        sample.acc,
        sample.speed,
      );
    }
  });
}

export async function loadPoints(sessionId: string): Promise<LocationSample[]> {
  return (await db()).getAllAsync<LocationSample>(
    "SELECT t, lat, lng, alt, acc, speed FROM points WHERE session_id = ? ORDER BY t",
    sessionId,
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  const database = await db();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "DELETE FROM points WHERE session_id = ?",
      sessionId,
    );
    await database.runAsync(
      "DELETE FROM uploads WHERE session_id = ?",
      sessionId,
    );
    await database.runAsync("DELETE FROM sessions WHERE id = ?", sessionId);
  });
}

export async function enqueueUpload(
  sessionId: string,
  userId: string,
  summary: RecordedActivityRequest,
  track: TrackFile | null,
): Promise<void> {
  const database = await db();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "INSERT OR REPLACE INTO uploads (session_id, user_id, summary, track, attempts, last_error, created_at) VALUES (?, ?, ?, ?, 0, NULL, ?)",
      sessionId,
      userId,
      JSON.stringify(summary),
      track ? JSON.stringify(track) : null,
      Date.now(),
    );
    await database.runAsync(
      "UPDATE sessions SET status = 'saving', updated_at = ? WHERE id = ?",
      Date.now(),
      sessionId,
    );
  });
}

type UploadRow = {
  session_id: string;
  user_id: string;
  summary: string;
  track: string | null;
  attempts: number;
  last_error: string | null;
};

export async function listUploads(userId: string): Promise<StoredUpload[]> {
  const rows = await (
    await db()
  ).getAllAsync<UploadRow>(
    "SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at",
    userId,
  );
  return rows.map((row) => ({
    sessionId: row.session_id,
    userId: row.user_id,
    summary: JSON.parse(row.summary) as RecordedActivityRequest,
    track: row.track ? (JSON.parse(row.track) as TrackFile) : null,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

export async function markUploadFailed(
  sessionId: string,
  error: string,
): Promise<void> {
  await (
    await db()
  ).runAsync(
    "UPDATE uploads SET attempts = attempts + 1, last_error = ? WHERE session_id = ?",
    error.slice(0, 500),
    sessionId,
  );
}
