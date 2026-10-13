import { planKeys } from "../../features/plans/hooks/plan-query-keys";

/**
 * Every React Query key of the app. Keys are hierarchical: invalidating a
 * prefix (`workouts.all`) refreshes everything below it.
 */
export const queryKeys = {
  athlete: {
    all: ["athlete"] as const,
    me: () => ["athlete", "me"] as const,
  },
  coach: {
    all: ["coach"] as const,
    workoutNote: (workoutId: string) =>
      ["coach", "workout-note", workoutId] as const,
  },
  consents: {
    all: ["consents"] as const,
  },
  gear: {
    all: ["gear"] as const,
    list: (status: string) => ["gear", status] as const,
  },
  health: {
    availability: () => ["health", "availability"] as const,
  },
  integrations: {
    all: ["integrations"] as const,
    strava: () => ["integrations", "strava"] as const,
    sync: (provider: string | null) =>
      ["integrations", provider, "sync"] as const,
  },
  /** The active plan as shown on the Plan tab. */
  plan: {
    all: ["plan"] as const,
    overview: planKeys.overview,
  },
  plans: planKeys,
  preferences: {
    all: ["preferences"] as const,
  },
  profile: {
    all: ["profile"] as const,
  },
  progress: {
    all: ["progress"] as const,
    overview: (period: string) => ["progress", "overview", period] as const,
    metric: (metric: string, period: string) =>
      ["progress", "metric", metric, period] as const,
    records: () => ["progress", "records"] as const,
    record: (distance: string | null) =>
      ["progress", "records", distance] as const,
  },
  tracker: {
    healthTarget: () => ["tracker", "health-target"] as const,
    heartRate: (startedAt: number | null, endedAt: number | null) =>
      ["tracker", "heart-rate", startedAt, endedAt] as const,
  },
  workouts: {
    all: ["workouts"] as const,
    range: (range: { from?: string; to?: string }) =>
      ["workouts", range] as const,
    detail: (workoutId: string) => ["workouts", "detail", workoutId] as const,
    execution: (workoutId: string) =>
      ["workouts", "execution", workoutId] as const,
    recording: (workoutId: string) =>
      ["workouts", "recording", workoutId] as const,
    sources: (workoutId: string | null) =>
      ["workouts", "sources", workoutId] as const,
  },
};
