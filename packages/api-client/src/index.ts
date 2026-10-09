import { z } from "zod";

export { z };

export interface ApiClientOptions {
  baseUrl: string;
}

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  avatarUrl: z.string().url().optional().nullable(),
  referralCode: z.string().optional().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string().or(z.date()).optional(),
  permissions: z.array(z.string()).optional(),
  features: z.object({
    showReferral: z.boolean().default(false),
    theme: z.string().optional(),
  }).optional().default({ showReferral: false }),
});

export const authTokensSchema = z.object({
  tokenType: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  sessionId: z.string(),
  accessTokenExpiresIn: z.number(),
  user: authUserSchema,
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const authResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: z.string().min(8),
});

export const authActivateInviteSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d+$/, "Invite code must contain digits only"),
  newPassword: z.string().min(8),
});

export const authRequestEmailVerificationSchema = z.object({
  email: z.string().email(),
});

export const authVerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * Self-service password change. The 8 character minimum mirrors the backend
 * `ChangePasswordDto`, so an obviously too short password is rejected before
 * the request instead of after it.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * Answer of the avatar upload endpoint. The URL is absolute and carries the
 * file id as a version parameter, so it changes on every replacement.
 */
export const avatarUploadSchema = z.object({
  avatarUrl: z.string().url(),
});

export const mobileAuthEmailRequestSchema = z.object({
  email: z.string().email(),
});

export const mobileAuthEmailVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{4}$/),
});

export const mobileAuthChallengeSchema = z.object({
  email: z.string().email(),
  expiresInSeconds: z.number().int().positive(),
  resendAfterSeconds: z.number().int().positive(),
});

export const mobileAuthSocialProviderSchema = z.enum(["google", "apple"]);

export const mobileAuthSocialSchema = z.object({
  provider: mobileAuthSocialProviderSchema,
  identityToken: z.string().min(1),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
});

export const mobileAuthSocialExchangeSchema = z.object({
  code: z.string().min(1),
});

export const appleNativeExchangeSchema = z.object({
  authorizationCode: z.string().min(1),
});

export const googleNativeExchangeSchema = z.object({
  idToken: z.string().min(1),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthForgotPasswordInput = z.infer<typeof authForgotPasswordSchema>;
export type AuthResetPasswordInput = z.infer<typeof authResetPasswordSchema>;
export type AuthActivateInviteInput = z.infer<typeof authActivateInviteSchema>;
export type AuthRequestEmailVerificationInput = z.infer<
  typeof authRequestEmailVerificationSchema
>;
export type AuthVerifyEmailInput = z.infer<typeof authVerifyEmailSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type MobileAuthEmailRequestInput = z.infer<
  typeof mobileAuthEmailRequestSchema
>;
export type MobileAuthEmailVerifyInput = z.infer<
  typeof mobileAuthEmailVerifySchema
>;
export type MobileAuthChallenge = z.infer<typeof mobileAuthChallengeSchema>;
export type MobileAuthSocialProvider = z.infer<
  typeof mobileAuthSocialProviderSchema
>;
export type MobileAuthSocialInput = z.infer<typeof mobileAuthSocialSchema>;
export type MobileAuthSocialExchangeInput = z.infer<
  typeof mobileAuthSocialExchangeSchema
>;
export type AppleNativeExchangeInput = z.infer<
  typeof appleNativeExchangeSchema
>;
export type GoogleNativeExchangeInput = z.infer<
  typeof googleNativeExchangeSchema
>;

export interface ApiErrorShape {
  statusCode?: number;
  message?: string;
  code?: string;
  path?: string;
  timestamp?: string;
  traceId?: string;
}

// --- Training ---

export const trainingAthleteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  age: z.number().nullable(),
  sex: z.string().nullable(),
  heightCm: z.number().nullable(),
  weightKg: z.number().nullable(),
  experienceLevel: z.string(),
  weeklyMileageKm: z.number().nullable(),
  sessionsPerWeek: z.number(),
  recentRaceResults: z.array(z.record(z.string(), z.unknown())),
  preferredTrainingDays: z.array(z.string()),
  availableTrainingDays: z.array(z.string()),
  preferredWorkoutDurationMinutes: z.number().nullable(),
  birthDate: z.string().nullable().optional(),
  restingHeartRate: z.number().nullable().optional(),
  maxHeartRate: z.number().nullable().optional(),
  thresholdHeartRate: z.number().nullable().optional(),
  hrZonesMethod: z.enum(["threshold", "max_hr", "custom"]).optional(),
  hrZonesCustom: z.array(z.number()).nullable().optional(),
  runningSinceYear: z.number().nullable().optional(),
  limitations: z.string().nullable().optional(),
  preferredTimeOfDay: z.enum(["morning", "day", "evening", "any"]).optional(),
  longRunDay: z.string().nullable().optional(),
  longRunMaxDurationMinutes: z.number().nullable().optional(),
  fieldSources: z
    .record(z.string(), z.object({ source: z.enum(["manual", "strava"]), updatedAt: z.string() }))
    .optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const hrZonesMethodSchema = z.enum(["threshold", "max_hr", "custom"]);
export const timeOfDaySchema = z.enum(["morning", "day", "evening", "any"]);
export const athleteSexSchema = z.enum(["female", "male", "other", "prefer_not_to_say"]);
export const experienceLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const trainingWeekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const hrZoneSchema = z.object({
  zone: z.number(),
  min: z.number().nullable(),
  max: z.number().nullable(),
});

export const profileCompletenessSchema = z.object({
  percent: z.number(),
  missing: z.array(z.string()),
});

/** `GET/PATCH /athletes/me`: stored inputs plus values the server derives from them. */
export const athleteProfileSchema = trainingAthleteSchema.extend({
  maxHeartRateEstimate: z.number().nullable().optional(),
  hrZones: z.array(hrZoneSchema).nullable().optional(),
  hrZonesUnavailableReason: z.enum(["threshold_missing", "max_missing", "custom_missing"]).nullable().optional(),
  weeklyMileageSuggestion: z
    .object({ valueKm: z.number(), source: z.string(), windowDays: z.number() })
    .nullable()
    .optional(),
  completeness: profileCompletenessSchema.optional(),
});

/** Partial profile update; `null` clears a field. */
export const athleteProfileUpdateSchema = z
  .object({
    birthDate: z.string().nullable(),
    sex: athleteSexSchema.nullable(),
    heightCm: z.number().int().nullable(),
    weightKg: z.number().nullable(),
    restingHeartRate: z.number().int().nullable(),
    maxHeartRate: z.number().int().nullable(),
    thresholdHeartRate: z.number().int().nullable(),
    hrZonesMethod: hrZonesMethodSchema,
    hrZonesCustom: z.array(z.number().int()).length(4).nullable(),
    experienceLevel: experienceLevelSchema,
    runningSinceYear: z.number().int().nullable(),
    limitations: z.string().max(500).nullable(),
    availableTrainingDays: z.array(trainingWeekdaySchema),
    preferredTimeOfDay: timeOfDaySchema,
    sessionsPerWeek: z.number().int(),
    longRunDay: trainingWeekdaySchema.nullable(),
    preferredWorkoutDurationMinutes: z.number().int().nullable(),
    longRunMaxDurationMinutes: z.number().int().nullable(),
    weeklyMileageKm: z.number().nullable(),
    resetSources: z.array(z.enum(["weightKg", "sex", "heightCm", "birthDate"])),
  })
  .partial();

export type HrZonesMethod = z.infer<typeof hrZonesMethodSchema>;
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;
export type AthleteSex = z.infer<typeof athleteSexSchema>;
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;
export type TrainingWeekday = z.infer<typeof trainingWeekdaySchema>;
export type HrZone = z.infer<typeof hrZoneSchema>;
export type ProfileCompleteness = z.infer<typeof profileCompletenessSchema>;
export type AthleteProfile = z.infer<typeof athleteProfileSchema>;
export type AthleteProfileUpdate = z.infer<typeof athleteProfileUpdateSchema>;

// --- Gear ---

export const gearStatusSchema = z.enum(["active", "retired"]);

export const gearSchema = z.object({
  id: z.string(),
  type: z.string(),
  brand: z.string(),
  model: z.string(),
  nickname: z.string().nullable(),
  initialDistanceKm: z.number(),
  limitKm: z.number(),
  startedAt: z.string().nullable(),
  retiredAt: z.string().nullable(),
  status: gearStatusSchema,
  defaultWorkoutTypes: z.array(z.string()),
  replaceReminder: z.boolean(),
  source: z.enum(["manual", "strava"]),
  distanceKm: z.number(),
  workoutsCount: z.number(),
  remainingKm: z.number(),
  wearPercent: z.number(),
  replaceSoon: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const gearListSchema = z.object({ items: z.array(gearSchema) });

export const gearInputSchema = z.object({
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  nickname: z.string().trim().max(60).nullable().optional(),
  initialDistanceKm: z.number().min(0).max(10000).optional(),
  limitKm: z.number().int().min(100).max(2000).optional(),
  startedAt: z.string().nullable().optional(),
  defaultWorkoutTypes: z.array(z.string()).optional(),
  replaceReminder: z.boolean().optional(),
});

export type GearStatus = z.infer<typeof gearStatusSchema>;
export type Gear = z.infer<typeof gearSchema>;
export type GearList = z.infer<typeof gearListSchema>;
export type GearInput = z.infer<typeof gearInputSchema>;

// --- User preferences ---

export const coachAdaptationModeSchema = z.enum(["auto", "confirm", "suggest"]);

export const quietHoursSchema = z.object({ from: z.string(), to: z.string() });

export const userPreferencesSchema = z.object({
  units: z.enum(["metric", "imperial"]),
  weekStart: z.enum(["mon", "sun"]),
  timeFormat: z.enum(["24h", "12h"]),
  coachEnabled: z.boolean(),
  coachAdaptationMode: coachAdaptationModeSchema,
  coachQuietHours: quietHoursSchema.nullable(),
  stravaProfileSync: z.boolean(),
  timezone: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});

export const userPreferencesUpdateSchema = userPreferencesSchema
  .omit({ updatedAt: true })
  .extend({ timezone: z.string() })
  .partial();

export type CoachAdaptationMode = z.infer<typeof coachAdaptationModeSchema>;

/** Adaptation of the active plan waiting for the user (`proposed`) or shown as advice (`suggested`). */
export const pendingAdaptationSchema = z.object({
  id: z.string(),
  planId: z.string().nullable(),
  workoutId: z.string().nullable(),
  type: z.string(),
  reason: z.string(),
  status: z.enum(["applied", "proposed", "suggested", "dismissed"]).optional(),
  decision: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export const pendingAdaptationListSchema = z.object({ items: z.array(pendingAdaptationSchema) });
export type PendingAdaptation = z.infer<typeof pendingAdaptationSchema>;
export type QuietHours = z.infer<typeof quietHoursSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesUpdate = z.infer<typeof userPreferencesUpdateSchema>;

export const trainingStateSchema = z.object({
  id: z.string(),
  athleteId: z.string(),
  fitness: z.number(),
  fatigue: z.number(),
  form: z.number(),
  thresholdPaceSecondsPerKm: z.number().nullable(),
  thresholdHeartRate: z.number().nullable(),
  vo2max: z.number().nullable(),
  weeklyLoad: z.number(),
  acuteLoad: z.number(),
  chronicLoad: z.number(),
  recoveryScore: z.number().nullable(),
  confidence: z.number(),
  source: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const trainingWorkoutAnalysisSchema = z.object({
  completion: z.number(),
  performanceDelta: z.number(),
  load: z.number(),
  expectedLoad: z.number(),
  fatigueImpact: z.enum(["low", "moderate", "high"]),
  confidence: z.number(),
  analysisVersion: z.string(),
});

export const trainingWorkoutSchema = z.object({
  id: z.string(),
  athleteId: z.string(),
  goalId: z.string().nullable(),
  planId: z.string().nullable(),
  weekNumber: z.number(),
  scheduledAt: z.string().or(z.date()),
  type: z.string(),
  phase: z.string(),
  status: z.string(),
  orderInWeek: z.number(),
  durationMinutes: z.number(),
  distanceKm: z.number(),
  target: z.record(z.string(), z.unknown()),
  steps: z.array(z.record(z.string(), z.unknown())),
  actual: z.record(z.string(), z.unknown()).nullable(),
  analysis: trainingWorkoutAnalysisSchema.nullable(),
  completedAt: z.string().or(z.date()).nullable(),
  gearId: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const trainingPlanWeekSchema = z.object({
  weekNumber: z.number(),
  phase: z.string(),
  weeklyLoadTarget: z.number(),
  workoutIds: z.array(z.string()),
});

export const trainingPlanSchema = z.object({
  id: z.string(),
  athleteId: z.string(),
  goalId: z.string().nullable(),
  name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  version: z.number().optional(),
  // Drafts have no dates until they are started.
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  trainingFrequency: z.number(),
  weeklyTargetKm: z.number(),
  status: z.string(),
  algorithmVersion: z.string(),
  weeks: z.array(trainingPlanWeekSchema),
  workouts: z.array(trainingWorkoutSchema),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type TrainingAthlete = z.infer<typeof trainingAthleteSchema>;
export type TrainingState = z.infer<typeof trainingStateSchema>;
export type TrainingWorkout = z.infer<typeof trainingWorkoutSchema>;
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;
export type TrainingWorkoutAnalysis = z.infer<
  typeof trainingWorkoutAnalysisSchema
>;

export const createWorkoutSchema = z.object({
  scheduledAt: z.string(),
  type: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  durationMinutes: z.number().optional(),
  distanceKm: z.number().optional(),
  status: z.enum(["planned", "completed"]).optional(),
  actualDurationMinutes: z.number().optional(),
  actualDistanceKm: z.number().optional(),
  actualAveragePaceSecondsPerKm: z.number().optional(),
  actualAverageHeartRate: z.number().optional(),
  rpe: z.number().optional(),
  notes: z.string().optional(),
});

export const completeWorkoutSchema = z.object({
  actualDurationMinutes: z.number(),
  actualDistanceKm: z.number(),
  actualAveragePaceSecondsPerKm: z.number().optional(),
  actualAverageHeartRate: z.number().optional(),
  rpe: z.number().optional(),
  notes: z.string().optional(),
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>;

// --- Training Goals Taxonomy & Universal Goal Model ---

export const ATHLETE_GOAL_TYPES = [
  // Race & Event
  'prepare_for_race',
  'improve_race_result',
  'run_new_distance',
  'trail_preparation',
  'ultra_preparation',
  'backyard_preparation',
  // Performance
  'improve_speed',
  'improve_pace',
  'build_endurance',
  'improve_aerobic_fitness',
  'improve_hills',
  // Training habit
  'start_running',
  'return_to_running',
  'build_consistency',
  'increase_running_volume',
  'run_continuously',
  // Fitness & Lifestyle
  'lose_weight',
  'maintain_fitness',
  'general_health',
  // Challenge
  'complete_challenge',
  // Flexible
  'custom',
] as const;

export type AthleteGoalType = (typeof ATHLETE_GOAL_TYPES)[number];

export const ATHLETE_GOAL_CATEGORIES = [
  'race_event',
  'performance',
  'training_habit',
  'fitness_lifestyle',
  'challenge',
  'flexible',
] as const;

export type AthleteGoalCategory = (typeof ATHLETE_GOAL_CATEGORIES)[number];

export const GOAL_TYPE_CATEGORY: Record<AthleteGoalType, AthleteGoalCategory> = {
  prepare_for_race: 'race_event',
  improve_race_result: 'race_event',
  run_new_distance: 'race_event',
  trail_preparation: 'race_event',
  ultra_preparation: 'race_event',
  backyard_preparation: 'race_event',
  improve_speed: 'performance',
  improve_pace: 'performance',
  build_endurance: 'performance',
  improve_aerobic_fitness: 'performance',
  improve_hills: 'performance',
  start_running: 'training_habit',
  return_to_running: 'training_habit',
  build_consistency: 'training_habit',
  increase_running_volume: 'training_habit',
  run_continuously: 'training_habit',
  lose_weight: 'fitness_lifestyle',
  maintain_fitness: 'fitness_lifestyle',
  general_health: 'fitness_lifestyle',
  complete_challenge: 'challenge',
  custom: 'flexible',
};

export const GOAL_METRIC_KEYS = [
  'distanceMeters',
  'finishTimeSec',
  'paceSecondsPerKm',
  'weightKg',
  'runsPerWeek',
  'weeklyDistanceKm',
  'weeklyDurationMinutes',
  'continuousDurationMinutes',
  'continuousDistanceKm',
  'elevationGainMeters',
  'shortDistanceResultSec',
  'benchmarkValue',
  'timeOnFeetMinutes',
  'loopsCount',
  'challengeMetric',
  'challengeTargetValue',
  'challengePeriod',
  'challengeProgressValue',
] as const;

export type GoalMetricKey = (typeof GOAL_METRIC_KEYS)[number];

export type GoalChallengeMetric = 'total_distance' | 'total_duration' | 'runs_count' | 'active_days';
export type GoalChallengePeriod = 'this_week' | 'this_month' | 'this_year' | 'custom';

export const GOAL_CHALLENGE_METRICS: readonly GoalChallengeMetric[] = [
  'total_distance',
  'total_duration',
  'runs_count',
  'active_days',
];

export const GOAL_CHALLENGE_PERIODS: readonly GoalChallengePeriod[] = [
  'this_week',
  'this_month',
  'this_year',
  'custom',
];

export const GOAL_METRIC_BOUNDS: Record<GoalMetricKey, { min: number; max: number; integer?: boolean }> = {
  distanceMeters: { min: 500, max: 300_000, integer: true },
  finishTimeSec: { min: 60, max: 260_000, integer: true },
  paceSecondsPerKm: { min: 120, max: 1_200, integer: true },
  weightKg: { min: 25, max: 350 },
  runsPerWeek: { min: 1, max: 14, integer: true },
  weeklyDistanceKm: { min: 1, max: 400 },
  weeklyDurationMinutes: { min: 20, max: 6_000, integer: true },
  continuousDurationMinutes: { min: 3, max: 1_440, integer: true },
  continuousDistanceKm: { min: 0.5, max: 300 },
  elevationGainMeters: { min: 0, max: 10_000, integer: true },
  shortDistanceResultSec: { min: 5, max: 3_600, integer: true },
  benchmarkValue: { min: 0, max: 10_000 },
  timeOnFeetMinutes: { min: 30, max: 4_320, integer: true },
  loopsCount: { min: 1, max: 100, integer: true },
  challengeMetric: { min: 0, max: 0 },
  challengeTargetValue: { min: 1, max: 100_000 },
  challengePeriod: { min: 0, max: 0 },
  challengeProgressValue: { min: 0, max: 100_000 },
};

export interface GoalTypeConfig {
  targetFields: readonly GoalMetricKey[];
  currentFields: readonly GoalMetricKey[];
  requiredTargetGroups: readonly (readonly GoalMetricKey[])[];
  requiresDescription?: boolean;
}

const T: Record<string, readonly GoalMetricKey[]> = {
  distance: ['distanceMeters'],
  finishTime: ['finishTimeSec'],
  pace: ['paceSecondsPerKm'],
  weight: ['weightKg'],
  runsPerWeek: ['runsPerWeek'],
  weeklyVolume: ['weeklyDistanceKm', 'weeklyDurationMinutes'],
  continuous: ['continuousDurationMinutes', 'continuousDistanceKm'],
};

const RACE_CURRENT: readonly GoalMetricKey[] = ['distanceMeters', 'finishTimeSec', 'paceSecondsPerKm'];

export const GOAL_TYPE_CONFIG: Record<AthleteGoalType, GoalTypeConfig> = {
  prepare_for_race: {
    targetFields: [...T.distance, ...T.finishTime],
    currentFields: [...RACE_CURRENT],
    requiredTargetGroups: [T.distance],
  },
  improve_race_result: {
    targetFields: [...T.distance, ...T.finishTime],
    currentFields: [...RACE_CURRENT],
    requiredTargetGroups: [T.distance, T.finishTime],
  },
  run_new_distance: {
    targetFields: [...T.distance],
    currentFields: [...RACE_CURRENT],
    requiredTargetGroups: [T.distance],
  },
  trail_preparation: {
    targetFields: ['distanceMeters', 'elevationGainMeters'],
    currentFields: ['distanceMeters', 'elevationGainMeters', 'weeklyDistanceKm'],
    requiredTargetGroups: [T.distance],
  },
  ultra_preparation: {
    targetFields: ['distanceMeters', 'elevationGainMeters'],
    currentFields: ['distanceMeters', 'weeklyDistanceKm'],
    requiredTargetGroups: [T.distance],
  },
  backyard_preparation: {
    targetFields: ['loopsCount', 'timeOnFeetMinutes', 'distanceMeters'],
    currentFields: ['timeOnFeetMinutes', 'distanceMeters'],
    requiredTargetGroups: [],
  },
  improve_speed: {
    targetFields: ['shortDistanceResultSec', 'paceSecondsPerKm', 'benchmarkValue'],
    currentFields: ['shortDistanceResultSec', 'paceSecondsPerKm', 'benchmarkValue'],
    requiredTargetGroups: [],
  },
  improve_pace: {
    targetFields: [...T.pace, 'distanceMeters'],
    currentFields: [...T.pace, ...T.distance],
    requiredTargetGroups: [T.pace],
  },
  build_endurance: {
    targetFields: [...T.continuous],
    currentFields: ['continuousDurationMinutes', 'continuousDistanceKm', 'distanceMeters'],
    requiredTargetGroups: [T.continuous],
  },
  improve_aerobic_fitness: {
    targetFields: ['benchmarkValue'],
    currentFields: ['benchmarkValue'],
    requiredTargetGroups: [],
  },
  improve_hills: {
    targetFields: ['elevationGainMeters', 'continuousDurationMinutes'],
    currentFields: ['elevationGainMeters', 'benchmarkValue'],
    requiredTargetGroups: [],
  },
  start_running: {
    targetFields: ['continuousDurationMinutes', 'continuousDistanceKm'],
    currentFields: ['continuousDurationMinutes', 'continuousDistanceKm'],
    requiredTargetGroups: [],
  },
  return_to_running: {
    targetFields: ['weeklyDistanceKm', 'continuousDurationMinutes'],
    currentFields: ['weeklyDistanceKm', 'continuousDurationMinutes', 'continuousDistanceKm'],
    requiredTargetGroups: [],
  },
  build_consistency: {
    targetFields: [...T.runsPerWeek],
    currentFields: [...T.runsPerWeek],
    requiredTargetGroups: [T.runsPerWeek],
  },
  increase_running_volume: {
    targetFields: [...T.weeklyVolume],
    currentFields: [...T.weeklyVolume],
    requiredTargetGroups: [T.weeklyVolume],
  },
  run_continuously: {
    targetFields: [...T.continuous],
    currentFields: [...T.continuous],
    requiredTargetGroups: [T.continuous],
  },
  lose_weight: {
    targetFields: [...T.weight],
    currentFields: [...T.weight],
    requiredTargetGroups: [T.weight],
  },
  maintain_fitness: {
    targetFields: ['runsPerWeek', 'weeklyDistanceKm'],
    currentFields: ['runsPerWeek', 'weeklyDistanceKm'],
    requiredTargetGroups: [],
  },
  general_health: {
    targetFields: ['runsPerWeek', 'weeklyDurationMinutes'],
    currentFields: ['runsPerWeek'],
    requiredTargetGroups: [],
  },
  complete_challenge: {
    targetFields: ['challengeMetric', 'challengeTargetValue', 'challengePeriod'],
    currentFields: ['challengeProgressValue'],
    requiredTargetGroups: [['challengeMetric', 'challengeTargetValue'] as readonly GoalMetricKey[]],
  },
  custom: {
    targetFields: [],
    currentFields: [],
    requiredTargetGroups: [],
    requiresDescription: true,
  },
};

export interface GoalValidationResult {
  valid: boolean;
  code?: string;
  field?: string;
}

export function validateGoalPayload(goal: {
  type: AthleteGoalType;
  current?: Record<string, unknown> | null;
  target?: Record<string, unknown> | null;
  description?: string | null;
}): GoalValidationResult {
  const config = GOAL_TYPE_CONFIG[goal.type];
  if (!config) {
    return { valid: false, code: 'GOAL_TYPE_UNKNOWN' };
  }

  if (config.requiresDescription && !(typeof goal.description === 'string' && goal.description.trim().length > 0)) {
    return { valid: false, code: 'GOAL_DESCRIPTION_REQUIRED' };
  }

  const target = goal.target ?? {};

  for (const group of config.requiredTargetGroups) {
    const satisfied = group.some((field) => {
      const value = target[field];
      return value !== undefined && value !== null && value !== '';
    });
    if (!satisfied) {
      return { valid: false, code: 'GOAL_TARGET_REQUIRED', field: group[0] };
    }
  }

  return { valid: true };
}

export const athleteGoalTypeSchema = z.enum(ATHLETE_GOAL_TYPES);
export const athleteGoalCategorySchema = z.enum(ATHLETE_GOAL_CATEGORIES);

export const athleteGoalPayloadSchema = z.object({
  type: athleteGoalTypeSchema,
  current: z.record(z.string(), z.unknown()).nullable().optional(),
  target: z.record(z.string(), z.unknown()).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

export type AthleteGoalPayloadInput = z.infer<typeof athleteGoalPayloadSchema>;

export const LEGACY_RACE_DISTANCE_METERS: Record<string, number> = {
  '5k': 5_000,
  '10k': 10_000,
  half_marathon: 21_097,
  marathon: 42_195,
};

export const LEGACY_RACE_DISTANCE_VALUES = ['5k', '10k', 'half_marathon', 'marathon', 'just_running'] as const;

export function mapLegacyRaceGoal(
  raceDistance: string,
  targetTimeSeconds?: number | null,
): { type: AthleteGoalType; target: Record<string, unknown> } {
  const distanceMeters = LEGACY_RACE_DISTANCE_METERS[raceDistance];
  const target: Record<string, unknown> = {};
  if (distanceMeters) {
    target.distanceMeters = distanceMeters;
  }
  if (targetTimeSeconds && distanceMeters) {
    return { type: 'improve_race_result', target: { ...target, finishTimeSec: targetTimeSeconds } };
  }
  return { type: 'prepare_for_race', target };
}

export function deriveLegacyRaceFields(goal: {
  type?: AthleteGoalType;
  target?: Record<string, unknown> | null;
}): {
  raceDistance: (typeof LEGACY_RACE_DISTANCE_VALUES)[number];
  targetTimeSeconds: number | null;
} {
  const distanceMeters = goal.target?.distanceMeters;
  const finishTimeSec = goal.target?.finishTimeSec;
  const targetTimeSeconds = typeof finishTimeSec === 'number' && Number.isFinite(finishTimeSec) ? finishTimeSec : null;

  if (typeof distanceMeters === 'number') {
    const matched = Object.entries(LEGACY_RACE_DISTANCE_METERS).find(
      ([, meters]) => Math.abs(meters - distanceMeters) < 1,
    );
    if (matched) {
      return { raceDistance: matched[0] as (typeof LEGACY_RACE_DISTANCE_VALUES)[number], targetTimeSeconds };
    }
  }

  return { raceDistance: 'just_running', targetTimeSeconds };
}

// --- Plan start options & athlete metrics ---

export const PLAN_NAME_MAX_LENGTH = 80;
export const PLAN_NOTES_MAX_LENGTH = 2000;
export const PLANS_LIMIT = 100;

/** Server-side validation ranges of user-entered athlete metrics. */
export const PLAN_METRIC_RANGES = {
  thresholdPaceSecondsPerKm: { min: 150, max: 600 },
  weeklyMileageKm: { min: 0, max: 300 },
  longestRunKm: { min: 0, max: 200 },
  maxHeartRate: { min: 120, max: 230 },
  restingHeartRate: { min: 30, max: 100 },
} as const;

export const activePlanSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  currentWeek: z.number(),
  totalWeeks: z.number(),
  completedWorkouts: z.number(),
  futurePlannedWorkouts: z.number(),
});

export const planStartOptionKindSchema = z.enum(["today", "next_monday", "race_aligned"]);

export const planStartOptionSchema = z.object({
  kind: planStartOptionKindSchema,
  startDate: z.string(),
  endDate: z.string(),
  goalTargetDate: z.string().optional(),
  fits: z.boolean().optional(),
  weeksAvailable: z.number().optional(),
  reason: z.literal("target_date_passed").optional(),
});

export const planStartOptionsSchema = z.object({
  today: z.string(),
  totalWeeks: z.number(),
  options: z.array(planStartOptionSchema),
  recommended: planStartOptionKindSchema,
  metricsStale: z.boolean(),
  activePlan: activePlanSummarySchema.nullable(),
});

export const planStartBlockSchema = z.object({
  startDate: z.string(),
  goalTargetDate: z.string().optional(),
  replaceActive: z.boolean(),
  timezone: z.string().optional(),
});

export const recentResultSchema = z.object({
  distance: z.string(),
  timeSeconds: z.number(),
  date: z.string(),
});

/** Metrics entered by the user; every field is optional. */
export const athleteMetricsSchema = z.object({
  thresholdPaceSecondsPerKm: z.number().optional(),
  thresholdHeartRate: z.number().int().optional(),
  maxHeartRate: z.number().int().optional(),
  restingHeartRate: z.number().int().optional(),
  weeklyMileageKm: z.number().optional(),
  longestRunKm: z.number().optional(),
  recentResult: recentResultSchema.optional(),
});

/** Metrics captured when a plan started; the "before" side of rebuild diffs. */
export const metricsSnapshotSchema = z.object({
  capturedAt: z.string().optional(),
  thresholdPaceSecondsPerKm: z.number().nullable().optional(),
  thresholdHeartRate: z.number().nullable().optional(),
  maxHeartRate: z.number().nullable().optional(),
  restingHeartRate: z.number().nullable().optional(),
  weeklyMileageKm: z.number().nullable().optional(),
  longestRunKm: z.number().nullable().optional(),
  recentResult: recentResultSchema.nullable().optional(),
  source: z.string().optional(),
});

export const metricsSourceSchema = z.enum(["profile", "strava", "manual_workouts", "athlete_state", "none"]);

const sourcedNumberSchema = z.object({
  value: z.number().nullable(),
  source: metricsSourceSchema,
});

export const currentMetricsSchema = z.object({
  thresholdPaceSecondsPerKm: sourcedNumberSchema,
  thresholdHeartRate: sourcedNumberSchema,
  maxHeartRate: sourcedNumberSchema,
  restingHeartRate: sourcedNumberSchema,
  weeklyMileageKm: sourcedNumberSchema,
  longestRunKm: sourcedNumberSchema,
  recentResult: z.object({
    value: recentResultSchema.nullable(),
    source: metricsSourceSchema,
  }),
});

export type ActivePlanSummary = z.infer<typeof activePlanSummarySchema>;
export type PlanStartOptionKind = z.infer<typeof planStartOptionKindSchema>;
export type PlanStartOption = z.infer<typeof planStartOptionSchema>;
export type PlanStartOptions = z.infer<typeof planStartOptionsSchema>;
export type PlanStartBlock = z.infer<typeof planStartBlockSchema>;
export type RecentResult = z.infer<typeof recentResultSchema>;
export type AthleteMetrics = z.infer<typeof athleteMetricsSchema>;
export type MetricsSnapshot = z.infer<typeof metricsSnapshotSchema>;
export type MetricsSource = z.infer<typeof metricsSourceSchema>;
export type CurrentMetrics = z.infer<typeof currentMetricsSchema>;

// --- Manual Plan Creation ---

export const manualPlanGoalSchema = z.object({
  type: athleteGoalTypeSchema.optional(),
  current: z.record(z.string(), z.unknown()).nullable().optional(),
  target: z.record(z.string(), z.unknown()).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  targetDate: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  // Legacy fields kept for backward compatibility
  raceDistance: z.enum(['5k', '10k', 'half_marathon', 'marathon', 'just_running']).optional(),
  targetTimeSeconds: z.number().int().nonnegative().optional(),
});

export const manualPlanScheduleSchema = z.object({
  trainingDays: z.array(z.number().int().min(0).max(6)).min(1),
  preferredLongRunDay: z.number().int().min(0).max(6).optional(),
  workoutDurationMinutes: z.number().int().positive().optional(),
});

export const manualPlanStructureSchema = z.object({
  totalWeeks: z.number().int().min(1).max(52),
  sessionsPerWeek: z.number().int().min(1).max(7),
  focus: z.array(z.string()).optional(),
});

export const manualPlanPreviewWorkoutSchema = z.object({
  id: z.string(),
  type: z.string(),
  phase: z.string(),
  weekNumber: z.number(),
  dayOfWeek: z.number(),
  scheduledAt: z.string(),
  orderInWeek: z.number(),
  durationMinutes: z.number(),
  distanceKm: z.number(),
  target: z.record(z.string(), z.unknown()),
  steps: z.array(z.record(z.string(), z.unknown())),
});

export const manualPlanPreviewWeekSchema = z.object({
  weekNumber: z.number(),
  phase: z.string(),
  title: z.string(),
  plannedWorkoutsCount: z.number(),
  plannedDistance: z.number(),
  plannedLoad: z.number(),
  workouts: z.array(manualPlanPreviewWorkoutSchema),
});

export const manualPlanPreviewSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  totalWeeks: z.number(),
  trainingFrequency: z.number(),
  weeklyTargetKm: z.number(),
  weeks: z.array(manualPlanPreviewWeekSchema),
  startOptions: planStartOptionsSchema.optional(),
});

export const manualPlanWorkoutOverrideSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  distanceKm: z.number().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export const manualPlanNewWorkoutSchema = z.object({
  type: z.string(),
  dayOfWeek: z.number().int().min(0).max(6),
  distanceKm: z.number().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export const manualPlanWeekOverridesSchema = z.object({
  weekNumber: z.number().int().min(1),
  workoutOverrides: z.array(manualPlanWorkoutOverrideSchema),
  removedWorkoutIds: z.array(z.string()),
  newWorkouts: z.array(manualPlanNewWorkoutSchema),
});

export const previewManualPlanSchema = z.object({
  goal: manualPlanGoalSchema,
  schedule: manualPlanScheduleSchema,
  structure: manualPlanStructureSchema,
  metrics: athleteMetricsSchema.optional(),
  timezone: z.string().optional(),
});

/** Name, notes and save mode shared by every plan creation endpoint. */
export const planSaveFieldsSchema = z.object({
  name: z.string().trim().min(1).max(PLAN_NAME_MAX_LENGTH).optional(),
  notes: z.string().max(PLAN_NOTES_MAX_LENGTH).nullable().optional(),
  saveAsDraft: z.boolean().optional(),
  start: planStartBlockSchema.optional(),
});

export const createManualPlanSchema = previewManualPlanSchema.extend({
  startDate: z.string().optional(),
  weekOverrides: z.array(manualPlanWeekOverridesSchema).optional(),
}).extend(planSaveFieldsSchema.shape);

export type ManualPlanGoalInput = z.infer<typeof manualPlanGoalSchema>;
export type ManualPlanScheduleInput = z.infer<typeof manualPlanScheduleSchema>;
export type ManualPlanStructureInput = z.infer<typeof manualPlanStructureSchema>;
export type ManualPlanPreviewWorkout = z.infer<typeof manualPlanPreviewWorkoutSchema>;
export type ManualPlanPreviewWeek = z.infer<typeof manualPlanPreviewWeekSchema>;
export type ManualPlanPreview = z.infer<typeof manualPlanPreviewSchema>;
export type ManualPlanWorkoutOverride = z.infer<typeof manualPlanWorkoutOverrideSchema>;
export type ManualPlanNewWorkout = z.infer<typeof manualPlanNewWorkoutSchema>;
export type ManualPlanWeekOverrides = z.infer<typeof manualPlanWeekOverridesSchema>;
export type PreviewManualPlanInput = z.infer<typeof previewManualPlanSchema>;
export type CreateManualPlanInput = z.infer<typeof createManualPlanSchema>;
export type PlanSaveFields = z.infer<typeof planSaveFieldsSchema>;

// --- Plan Overview ---

export const planPhaseSchema = z.enum([
  "BASE",
  "BUILD",
  "RECOVERY",
  "SPECIFIC",
  "PEAK",
  "TAPER",
  "RACE",
]);

export const planWeekStatusSchema = z.enum([
  "completed",
  "current",
  "upcoming",
]);

export const planWeekSchema = z.object({
  id: z.string(),
  weekNumber: z.number(),
  phase: planPhaseSchema,
  title: z.string(),
  status: planWeekStatusSchema,
  plannedWorkoutsCount: z.number().optional(),
  plannedDistance: z.number().optional(),
  plannedLoad: z.number().optional(),
  summaryText: z.string().optional(),
  intent: z.string().optional(),
  keySessions: z.array(z.string()).optional(),
});

export const currentWeekContextSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  focusItems: z.array(z.string()).optional(),
});

export const planAdaptationTypeSchema = z.enum([
  "HIGH_FATIGUE",
  "MISSED_WORKOUT",
  "POOR_PERFORMANCE",
  "EXCELLENT_PERFORMANCE",
  "LOW_RECOVERY",
  "SCHEDULE_CHANGE",
  "GOAL_CHANGE",
]);

export const planAdaptationSchema = z.object({
  id: z.string(),
  weekId: z.string().optional(),
  weekNumber: z.number().optional(),
  type: planAdaptationTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
});

export const planGoalSchema = z.object({
  title: z.string().optional(),
  distance: z.string(),
  targetTime: z.string().optional(),
  targetDate: z.string().optional(),
});

export const planStatusSchema = z.enum([
  "not_started",
  "active",
  "completed",
  "cancelled",
]);

/** Creation parameters of a plan; AI plans may store only part of them. */
export const planConfigSchema = z.object({
  goal: z.record(z.string(), z.unknown()).default({}),
  schedule: z
    .object({
      trainingDays: z.array(z.number()).optional(),
      preferredLongRunDay: z.number().nullable().optional(),
      workoutDurationMinutes: z.number().nullable().optional(),
    })
    .default({}),
  structure: z
    .object({
      totalWeeks: z.number().optional(),
      sessionsPerWeek: z.number().optional(),
      focus: z.array(z.string()).optional(),
    })
    .default({}),
});

export const planOverviewSchema = z.object({
  plan: z.object({
    id: z.string(),
    name: z.string().optional(),
    goal: planGoalSchema,
    status: planStatusSchema,
    currentWeek: z.number(),
    totalWeeks: z.number(),
    progress: z.number(),
    currentPhase: planPhaseSchema,
    startDate: z.string().optional(),
    notes: z.string().nullable().optional(),
    version: z.number().optional(),
    config: planConfigSchema.partial().optional(),
  }),
  weeks: z.array(planWeekSchema),
  currentWeekContext: currentWeekContextSchema.optional(),
  adaptations: z.array(planAdaptationSchema),
});

export type PlanPhase = z.infer<typeof planPhaseSchema>;
export type PlanWeekStatus = z.infer<typeof planWeekStatusSchema>;
export type PlanWeek = z.infer<typeof planWeekSchema>;
export type CurrentWeekContext = z.infer<typeof currentWeekContextSchema>;
export type PlanAdaptationType = z.infer<typeof planAdaptationTypeSchema>;
export type PlanAdaptation = z.infer<typeof planAdaptationSchema>;
export type PlanGoal = z.infer<typeof planGoalSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type PlanOverview = z.infer<typeof planOverviewSchema>;
export type PlanConfig = z.infer<typeof planConfigSchema>;

// --- Plans library: drafts, active plan, history ---

export const planLifecycleStatusSchema = z.enum(["draft", "active", "completed", "cancelled", "paused"]);
export const planListGroupSchema = z.enum(["draft", "active", "history"]);

export const planGoalSummarySchema = z.object({
  type: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
});

export const planStatsSchema = z.object({
  completedWorkouts: z.number(),
  plannedWorkouts: z.number(),
  completionRate: z.number(),
  totalDistanceKm: z.number(),
});

const planSummaryShape = {
  id: z.string(),
  name: z.string(),
  status: planLifecycleStatusSchema,
  creationSource: z.string(),
  goal: planGoalSummarySchema,
  totalWeeks: z.number(),
  sessionsPerWeek: z.number().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  stats: planStatsSchema.nullable().optional(),
  sourcePlanId: z.string().nullable().optional(),
  metricsStale: z.boolean().optional(),
  currentWeek: z.number().optional(),
  progress: z.number().optional(),
  updatedAt: z.string(),
};

export const planListItemSchema = z.object({
  ...planSummaryShape,
  notesPreview: z.string().nullable().optional(),
});

export const planListResponseSchema = z.object({
  items: z.array(planListItemSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    hasNext: z.boolean(),
  }),
});

export const planCountsSchema = z.object({
  draft: z.number(),
  active: z.number(),
  history: z.number(),
});

export const activePlanResponseSchema = z.object({
  plan: activePlanSummarySchema.nullable(),
});

/** Workout of a relative (undated) draft week; `dayOfWeek`: 0 = Monday. */
export const relativeWorkoutSchema = z.object({
  key: z.string(),
  dayOfWeek: z.number(),
  orderInWeek: z.number(),
  type: z.string(),
  phase: z.string(),
  title: z.string().optional(),
  durationMinutes: z.number(),
  distanceKm: z.number(),
  target: z.record(z.string(), z.unknown()),
  steps: z.array(z.record(z.string(), z.unknown())),
});

export const relativeWeekSchema = z.object({
  weekNumber: z.number(),
  phase: z.string(),
  title: z.string().nullable().optional(),
  intent: z.string().nullable().optional(),
  weeklyLoadTarget: z.number().nullable().optional(),
  workouts: z.array(relativeWorkoutSchema),
});

/** Week record of a plan: relative on drafts, dated (workoutIds) otherwise. */
export const planDetailsWeekSchema = z.object({
  weekNumber: z.number(),
  phase: z.string(),
  title: z.string().nullable().optional(),
  intent: z.string().nullable().optional(),
  weeklyLoadTarget: z.number().nullable().optional(),
  workouts: z.array(relativeWorkoutSchema).optional(),
  workoutIds: z.array(z.string()).optional(),
});

export const planWorkoutItemSchema = z.object({
  id: z.string(),
  weekNumber: z.number(),
  orderInWeek: z.number(),
  scheduledAt: z.string(),
  type: z.string(),
  status: z.string(),
  durationMinutes: z.number(),
  distanceKm: z.number(),
  target: z.record(z.string(), z.unknown()),
  actual: z.record(z.string(), z.unknown()).nullable(),
});

export const planDetailsSchema = z.object({
  ...planSummaryShape,
  cancelReason: z.string().nullable().optional(),
  notes: z.string().nullable(),
  version: z.number(),
  config: planConfigSchema,
  metricsSnapshot: metricsSnapshotSchema.nullable(),
  replacedByPlanId: z.string().nullable().optional(),
  weeks: z.array(planDetailsWeekSchema),
  workouts: z.array(planWorkoutItemSchema),
});

export const planMetaResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  notes: z.string().nullable(),
  version: z.number(),
});

export const planVersionResponseSchema = z.object({
  version: z.number(),
});

export const cancelPlanResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  cancelledWorkouts: z.number(),
});

export const updatePlanMetaSchema = z.object({
  name: z.string().trim().min(1).max(PLAN_NAME_MAX_LENGTH).optional(),
  notes: z.string().max(PLAN_NOTES_MAX_LENGTH).nullable().optional(),
  expectedVersion: z.number().int().min(0),
});

/** Draft structure edits; workouts are addressed by their relative key. */
export const draftWorkoutOverrideSchema = z.object({
  key: z.string(),
  type: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  distanceKm: z.number().min(0).optional(),
  durationMinutes: z.number().int().optional(),
});

export const draftWeekOverrideSchema = z.object({
  weekNumber: z.number().int().min(1),
  workoutOverrides: z.array(draftWorkoutOverrideSchema).optional(),
  removedWorkoutKeys: z.array(z.string()).optional(),
  newWorkouts: z.array(manualPlanNewWorkoutSchema).optional(),
});

export const updatePlanStructureSchema = z.object({
  expectedVersion: z.number().int().min(0),
  weekOverrides: z.array(draftWeekOverrideSchema),
});

// Changes of the active plan

export const planWorkoutOperationSchema = z.object({
  op: z.enum(["update", "move", "remove", "add"]),
  workoutId: z.string().optional(),
  date: z.string().optional(),
  type: z.string().optional(),
  distanceKm: z.number().optional(),
  durationMinutes: z.number().int().optional(),
});

export const planScheduleChangeSchema = z.object({
  trainingDays: z.array(z.number().int().min(0).max(6)).min(1),
  preferredLongRunDay: z.number().int().min(0).max(6).optional(),
  workoutDurationMinutes: z.number().int().optional(),
});

export const planChangeRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("workouts"),
    expectedVersion: z.number().int(),
    timezone: z.string().optional(),
    operations: z.array(planWorkoutOperationSchema).min(1),
  }),
  z.object({
    kind: z.literal("schedule"),
    expectedVersion: z.number().int(),
    timezone: z.string().optional(),
    schedule: planScheduleChangeSchema,
    effectiveFrom: z.enum(["next_week", "tomorrow"]).optional(),
  }),
  z.object({
    kind: z.literal("goal_date"),
    expectedVersion: z.number().int(),
    timezone: z.string().optional(),
    goalTargetDate: z.string(),
  }),
]);

export const planDiffAdjustmentSchema = z.object({
  code: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const planDiffWorkoutSchema = z.object({
  key: z.string(),
  change: z.enum(["added", "removed", "modified"]),
  fields: z.record(z.string(), z.tuple([z.unknown(), z.unknown()])).optional(),
  reason: z.string().optional(),
});

export const planDiffWeekSchema = z.object({
  weekNumber: z.number(),
  change: z.enum(["added", "removed", "modified"]),
  workouts: z.array(planDiffWorkoutSchema),
});

const beforeAfterNumber = z.object({ before: z.number().nullable(), after: z.number().nullable() });

export const planDiffSchema = z.object({
  summary: z.object({
    weeklyVolumeKm: z.object({ before: z.array(z.number()), after: z.array(z.number()) }),
    peakWeekKm: beforeAfterNumber,
    longestRunKm: beforeAfterNumber,
    thresholdPace: beforeAfterNumber,
    totalWeeks: beforeAfterNumber,
    adjustments: z.array(planDiffAdjustmentSchema),
  }),
  weeks: z.array(planDiffWeekSchema),
});

export const planChangePreviewSchema = z.object({
  diff: planDiffSchema,
  warnings: z.array(z.string()),
  resultingEndDate: z.string().nullable().optional(),
  version: z.number(),
});

// "Prepare again" (rebuild)

export const rebuildPrefillSchema = z.object({
  config: planConfigSchema,
  goalSuggestion: z.object({
    targetDate: z.string().nullable(),
    previousTargetDate: z.string().nullable(),
    previousResult: z.object({ timeSeconds: z.number(), workoutId: z.string() }).nullable(),
  }),
  metrics: z.object({
    previous: metricsSnapshotSchema.nullable().optional(),
    current: currentMetricsSchema,
  }),
});

export const rebuildTargetSchema = z.enum(["new_draft", "in_place"]);

export const rebuildPreviewRequestSchema = z.object({
  goal: manualPlanGoalSchema,
  schedule: manualPlanScheduleSchema,
  structure: manualPlanStructureSchema,
  metrics: athleteMetricsSchema,
  target: rebuildTargetSchema,
  timezone: z.string().optional(),
});

export const rebuildRequestSchema = rebuildPreviewRequestSchema
  .extend({
    weekOverrides: z.array(draftWeekOverrideSchema).optional(),
    expectedVersion: z.number().int().optional(),
  })
  .extend(planSaveFieldsSchema.shape);

export const rebuildPreviewSchema = z.object({
  mode: z.enum(["rebased", "regenerated"]),
  weeks: z.array(relativeWeekSchema),
  preview: manualPlanPreviewSchema,
  diff: planDiffSchema,
  warnings: z.array(z.string()),
  startOptions: planStartOptionsSchema,
});

export const startPlanSchema = planStartBlockSchema;

export type PlanLifecycleStatus = z.infer<typeof planLifecycleStatusSchema>;
export type PlanListGroup = z.infer<typeof planListGroupSchema>;
export type PlanGoalSummary = z.infer<typeof planGoalSummarySchema>;
export type PlanStats = z.infer<typeof planStatsSchema>;
export type PlanListItem = z.infer<typeof planListItemSchema>;
export type PlanListResponse = z.infer<typeof planListResponseSchema>;
export type PlanCounts = z.infer<typeof planCountsSchema>;
export type ActivePlanResponse = z.infer<typeof activePlanResponseSchema>;
export type RelativeWorkout = z.infer<typeof relativeWorkoutSchema>;
export type RelativeWeek = z.infer<typeof relativeWeekSchema>;
export type PlanDetailsWeek = z.infer<typeof planDetailsWeekSchema>;
export type PlanWorkoutItem = z.infer<typeof planWorkoutItemSchema>;
export type PlanDetails = z.infer<typeof planDetailsSchema>;
export type PlanMetaResponse = z.infer<typeof planMetaResponseSchema>;
export type CancelPlanResponse = z.infer<typeof cancelPlanResponseSchema>;
export type UpdatePlanMetaInput = z.infer<typeof updatePlanMetaSchema>;
export type DraftWorkoutOverride = z.infer<typeof draftWorkoutOverrideSchema>;
export type DraftWeekOverride = z.infer<typeof draftWeekOverrideSchema>;
export type UpdatePlanStructureInput = z.infer<typeof updatePlanStructureSchema>;
export type PlanWorkoutOperation = z.infer<typeof planWorkoutOperationSchema>;
export type PlanScheduleChange = z.infer<typeof planScheduleChangeSchema>;
export type PlanChangeRequest = z.infer<typeof planChangeRequestSchema>;
export type PlanDiffAdjustment = z.infer<typeof planDiffAdjustmentSchema>;
export type PlanDiffWorkout = z.infer<typeof planDiffWorkoutSchema>;
export type PlanDiffWeek = z.infer<typeof planDiffWeekSchema>;
export type PlanDiff = z.infer<typeof planDiffSchema>;
export type PlanChangePreview = z.infer<typeof planChangePreviewSchema>;
export type RebuildPrefill = z.infer<typeof rebuildPrefillSchema>;
export type RebuildTarget = z.infer<typeof rebuildTargetSchema>;
export type RebuildPreviewInput = z.infer<typeof rebuildPreviewRequestSchema>;
export type RebuildInput = z.infer<typeof rebuildRequestSchema>;
export type RebuildPreview = z.infer<typeof rebuildPreviewSchema>;
export type StartPlanInput = z.infer<typeof startPlanSchema>;

// --- Coach ---

export const coachSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  athleteId: z.string(),
  title: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  model: z.string(),
  lastMessageAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const coachMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  toolName: z.string().nullable().optional(),
  toolCallId: z.string().nullable().optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .transform((val) => val ?? {}),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const coachChatResponseSchema = z.object({
  session: coachSessionSchema,
  assistantMessage: coachMessageSchema,
  reply: z.string(),
  coachSummary: z.string(),
  toolResults: z.array(
    z.object({
      name: z.string(),
      input: z.record(z.string(), z.unknown()),
      output: z.record(z.string(), z.unknown()),
    }),
  ),
});

export const coachSessionDetailSchema = z.object({
  session: coachSessionSchema,
  messages: z.array(coachMessageSchema),
});

export const createCoachSessionSchema = z.object({
  athleteId: z.string(),
  title: z.string().optional(),
});

export const sendCoachMessageSchema = z.object({
  message: z.string(),
});

export type CoachSession = z.infer<typeof coachSessionSchema>;
export type CoachMessage = z.infer<typeof coachMessageSchema>;
export type CoachChatResponse = z.infer<typeof coachChatResponseSchema>;
export type CoachSessionDetail = z.infer<typeof coachSessionDetailSchema>;
export type CreateCoachSessionInput = z.infer<typeof createCoachSessionSchema>;
export type SendCoachMessageInput = z.infer<typeof sendCoachMessageSchema>;

// --- Progress ---

export const progressPeriodKeySchema = z.enum(["4W", "8W", "3M", "6M", "1Y"]);
export const recordDistanceSchema = z.enum(["1k", "5k", "10k", "half_marathon", "marathon"]);
export const capabilityTypeSchema = z.enum(["endurance", "threshold", "speed", "recovery", "consistency"]);
export const trendSchema = z.enum(["up", "down", "stable"]);

const secondsPointSchema = z.object({ date: z.string(), seconds: z.number() });

export const progressGoalSchema = z.object({
  id: z.string(),
  type: z.string(),
  date: z.string().nullable(),
  weeksLeft: z.number().nullable(),
  distanceKm: z.number().nullable(),
  targetSeconds: z.number().nullable(),
  forecastSeconds: z.number().nullable(),
  status: z.enum(["achieved", "on_track", "behind", "no_data", "no_forecast"]),
  series: z.array(secondsPointSchema),
  projection: z.array(secondsPointSchema),
  planName: z.string().nullable(),
});

export const recordBestSchema = z.object({
  seconds: z.number(),
  date: z.string(),
  source: z.enum(["workout", "result"]),
  kind: z.enum(["race", "workout", "test"]),
  provider: z.string().nullable(),
  name: z.string().nullable(),
  isNew: z.boolean(),
  workoutId: z.string().nullable(),
  resultId: z.string().nullable(),
});

export const progressRecordSchema = z.object({
  distance: recordDistanceSchema,
  best: recordBestSchema.nullable(),
  predictionSeconds: z.number().nullable().optional(),
});

const dynamicsSeriesSchema = z.object({
  average: z.number().nullable(),
  changePercent: z.number().nullable(),
  points: z.array(z.object({ start: z.string(), value: z.number().nullable() })),
});

export const progressOverviewSchema = z.object({
  period: z.object({ key: progressPeriodKeySchema, from: z.string(), to: z.string() }),
  metricsUnlock: z.object({ required: z.number(), completed: z.number(), unlocked: z.boolean() }),
  goal: progressGoalSchema.nullable(),
  predictions: z.array(z.object({ distance: recordDistanceSchema, seconds: z.number() })),
  predictionBasis: z.number(),
  form: z
    .object({
      fitness: z.number(),
      fatigue: z.number(),
      form: z.number(),
      fitnessChange: z.number(),
      changeWeeks: z.number(),
    })
    .nullable(),
  metrics: z.object({
    thresholdPace: z.object({ value: z.number(), change: z.number().nullable() }).nullable(),
    vo2max: z.object({ value: z.number(), change: z.number().nullable() }).nullable(),
    thresholdHeartRate: z.object({ value: z.number(), estimated: z.boolean() }).nullable(),
  }),
  capabilities: z
    .array(z.object({ type: capabilityTypeSchema, value: z.number().nullable(), trend: trendSchema }))
    .nullable(),
  records: z.array(progressRecordSchema),
  dynamics: z.object({
    bucket: z.enum(["week", "month"]),
    metrics: z.object({
      distance: dynamicsSeriesSchema,
      pace: dynamicsSeriesSchema,
      heartRate: dynamicsSeriesSchema,
      load: dynamicsSeriesSchema,
    }),
    profileVolumeHint: z.object({ profileKm: z.number(), actualKm: z.number() }).nullable(),
  }),
  achievements: z.array(
    z.object({
      kind: z.enum(["longest_run", "streak", "new_record", "total_distance"]),
      value: z.number(),
      date: z.string().nullable(),
      distance: recordDistanceSchema.optional(),
    }),
  ),
});

export const progressMetricSchema = z.object({
  metric: z.enum(["threshold_pace", "vo2max"]),
  value: z.number().nullable(),
  change: z.number().nullable(),
  updatedAt: z.string().nullable(),
  series: z.array(z.object({ date: z.string(), value: z.number() })),
  accuracy: z.object({ level: z.enum(["high", "medium", "low"]), efforts: z.number() }),
  zones: z
    .object({
      method: z.string(),
      maxHeartRate: z.number().nullable(),
      thresholdHeartRate: z.number().nullable(),
    })
    .optional(),
  paces: z
    .object({
      easy: z.tuple([z.number(), z.number()]),
      tempo: z.tuple([z.number(), z.number()]),
      interval: z.tuple([z.number(), z.number()]),
    })
    .optional(),
  topEfforts: z
    .array(
      z.object({
        id: z.string(),
        workoutId: z.string().nullable(),
        resultId: z.string().nullable(),
        title: z.string().nullable(),
        workoutType: z.string().nullable(),
        date: z.string(),
        distanceKm: z.number(),
        paceSecondsPerKm: z.number(),
      }),
    )
    .optional(),
});

export const progressRecordsSchema = z.object({ items: z.array(progressRecordSchema) });

export const recordAttemptSchema = z.object({
  id: z.string(),
  source: z.enum(["workout", "result"]),
  kind: z.enum(["race", "workout", "test"]),
  provider: z.string().nullable(),
  name: z.string().nullable(),
  date: z.string(),
  seconds: z.number(),
  workoutId: z.string().nullable(),
  resultId: z.string().nullable(),
});

export const recordHistorySchema = z.object({
  distance: recordDistanceSchema,
  attempts: z.array(recordAttemptSchema),
});

export const raceResultInputSchema = z.object({
  distanceM: z.number().int().min(400).max(100000),
  timeSeconds: z.number().int().min(60),
  date: z.string(),
  kind: z.enum(["race", "workout", "test"]),
  name: z.string().max(120).optional(),
});

export type ProgressPeriodKey = z.infer<typeof progressPeriodKeySchema>;
export type RecordDistance = z.infer<typeof recordDistanceSchema>;
export type CapabilityType = z.infer<typeof capabilityTypeSchema>;
export type ProgressGoal = z.infer<typeof progressGoalSchema>;
export type ProgressRecord = z.infer<typeof progressRecordSchema>;
export type ProgressOverview = z.infer<typeof progressOverviewSchema>;
export type ProgressMetricDetail = z.infer<typeof progressMetricSchema>;
export type RecordAttempt = z.infer<typeof recordAttemptSchema>;
export type RecordHistory = z.infer<typeof recordHistorySchema>;
export type RaceResultInput = z.infer<typeof raceResultInputSchema>;

// --- Integrations ---

export const integrationProviderSchema = z.enum([
  "strava",
  "garmin",
  "apple_health",
  "health_connect",
]);

export const integrationStatusSchema = z.enum([
  "connecting",
  "connected",
  "syncing",
  "error",
  "reauthorization_required",
  "disconnected",
]);

export const integrationItemSchema = z.object({
  provider: z.string(),
  status: z.string(),
  connectedAt: z.string().nullable().optional(),
  lastSyncedAt: z.string().nullable().optional(),
  externalUserId: z.string().nullable().optional(),
  importedActivitiesCount: z.number().optional(),
  profileAccess: z.boolean().optional(),
  lastProfileSyncAt: z.string().nullable().optional(),
});

export const stravaProfileAccessSchema = z.object({
  authorizeUrl: z.string(),
  state: z.string(),
});
export type StravaProfileAccess = z.infer<typeof stravaProfileAccessSchema>;

export const integrationsListSchema = z.object({
  items: z.array(integrationItemSchema),
});

export const stravaConnectResponseSchema = z.object({
  authUrl: z.string(),
  state: z.string(),
});

export const integrationSyncStatusSchema = z.object({
  status: z.string(),
  processed: z.number(),
  imported: z.number(),
  failed: z.number(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  estimatedCompletion: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type IntegrationItem = z.infer<typeof integrationItemSchema>;
export type IntegrationsList = z.infer<typeof integrationsListSchema>;
export type StravaConnectResponse = z.infer<typeof stravaConnectResponseSchema>;
export type IntegrationSyncStatus = z.infer<typeof integrationSyncStatusSchema>;

// --- Admin: shared ---

export const paginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  referralCode: z.string().nullable().optional(),
  emailVerified: z.boolean(),
  emailVerifiedAt: z.string().or(z.date()).nullable().optional(),
  isSystem: z.boolean(),
  systemKey: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  passwordChangedAt: z.string().or(z.date()).nullable().optional(),
});

export const adminUserGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  systemKey: z.string().nullable().optional(),
  isSystem: z.boolean(),
});

export const adminUserPermissionSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
});

export const adminUserDetailSchema = adminUserSchema.extend({
  groups: z.array(adminUserGroupSchema).default([]),
  individualPermissions: z.array(adminUserPermissionSchema).default([]),
  effectivePermissions: z.array(z.string()).default([]),
});

export const permissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

/** The complete, unpaginated permission catalog. */
export const permissionCatalogSchema = z.array(permissionSchema);

/**
 * Member projection returned by the group detail endpoint. The backend loads
 * group members with a restricted attribute set (`id`, `firstName`,
 * `lastName`, `email`, `isSystem`), so this intentionally does not reuse
 * `adminUserSchema`, which models the full admin user resource.
 */
export const permissionGroupMemberSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string(),
  isSystem: z.boolean().optional(),
});

export const permissionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  systemKey: z.string().nullable().optional(),
  isSystem: z.boolean().default(false),
  permissions: z.array(permissionSchema).optional(),
  users: z.array(permissionGroupMemberSchema).optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export const appSettingsSchema = z.object({
  defaultGroups: z.array(z.string()).default([]),
  defaultPermissions: z.array(z.string()).default([]),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  locale: z.enum(["ru", "en"]).default("en"),
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8).optional(),
  emailVerified: z.boolean().optional(),
  avatarUrl: z.string().url().optional(),
  referralCode: z.string().optional(),
});

export const adminUpdateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional(),
  referralCode: z.string().optional(),
  emailVerified: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  defaultGroups: z.array(z.string().uuid()).optional(),
  defaultPermissions: z.array(z.string().uuid()).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  locale: z.enum(["ru", "en"]).optional(),
});

export const userListQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "email", "firstName", "lastName"]).default("createdAt"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Presence answer: which of the requested users hold a live connection.
 *
 * A subset of what was asked for, never a full list of everybody online — the
 * caller only ever asks about rows it is already allowed to see.
 */
export const userPresenceSchema = z.object({
  onlineUserIds: z.array(z.string()),
});
export type UserPresence = z.infer<typeof userPresenceSchema>;

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUserGroup = z.infer<typeof adminUserGroupSchema>;
export type AdminUserPermission = z.infer<typeof adminUserPermissionSchema>;
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type PermissionGroup = z.infer<typeof permissionGroupSchema>;
export type PermissionGroupMember = z.infer<typeof permissionGroupMemberSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// --- Admin: user training calendar ---

export const WORKOUT_TYPES = [
  "recovery",
  "easy",
  "long_run",
  "tempo",
  "threshold",
  "interval",
  "hill",
  "race",
  "rest",
] as const;
export const WORKOUT_STATUSES = ["planned", "completed", "skipped", "cancelled"] as const;

/**
 * Statuses the admin panel may set. Completing a workout needs an actual
 * result and load recalculation, and cancelling is a plan lifecycle outcome,
 * so both stay with the athlete flow.
 */
export const ADMIN_WORKOUT_EDITABLE_STATUSES = ["planned", "skipped"] as const;

/** Bounds mirrored from the backend admin calendar DTOs. */
export const ADMIN_WORKOUT_LIMITS = {
  durationMinutes: { min: 1, max: 300 },
  distanceKm: { min: 0, max: 100 },
  titleMaxLength: 120,
} as const;

/** Longest range the month summary endpoint accepts, in days. */
export const ADMIN_CALENDAR_SUMMARY_MAX_DAYS = 62;

export const workoutTypeSchema = z.enum(WORKOUT_TYPES);
export const workoutStatusSchema = z.enum(WORKOUT_STATUSES);
export const adminWorkoutEditableStatusSchema = z.enum(ADMIN_WORKOUT_EDITABLE_STATUSES);

export const adminCalendarWorkoutSchema = z.object({
  id: z.string(),
  athleteId: z.string(),
  planId: z.string().nullable(),
  scheduledAt: z.string(),
  type: workoutTypeSchema,
  phase: z.string(),
  status: workoutStatusSchema,
  durationMinutes: z.number(),
  distanceKm: z.number(),
  title: z.string().nullable(),
  source: z.string().nullable(),
  hasActual: z.boolean(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminCalendarDaySchema = z.object({
  date: z.string(),
  timezone: z.string(),
  workouts: z.array(adminCalendarWorkoutSchema),
  total: z.number(),
  hasAthleteProfile: z.boolean(),
});

export const adminCalendarSummaryDaySchema = z.object({
  date: z.string(),
  total: z.number(),
  statuses: z.record(workoutStatusSchema, z.number()),
});

export const adminCalendarSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
  days: z.array(adminCalendarSummaryDaySchema),
});

export const adminWorkoutMutationSchema = z.object({
  workout: adminCalendarWorkoutSchema,
});

const adminWorkoutTitleSchema = z.string().trim().min(1).max(ADMIN_WORKOUT_LIMITS.titleMaxLength);

export const adminCreateWorkoutSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
  type: workoutTypeSchema,
  durationMinutes: z
    .number()
    .min(ADMIN_WORKOUT_LIMITS.durationMinutes.min)
    .max(ADMIN_WORKOUT_LIMITS.durationMinutes.max)
    .optional(),
  distanceKm: z
    .number()
    .min(ADMIN_WORKOUT_LIMITS.distanceKm.min)
    .max(ADMIN_WORKOUT_LIMITS.distanceKm.max)
    .optional(),
  status: adminWorkoutEditableStatusSchema.optional(),
  title: adminWorkoutTitleSchema.optional(),
});

export const adminUpdateWorkoutSchema = adminCreateWorkoutSchema.partial();

export type WorkoutType = z.infer<typeof workoutTypeSchema>;
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;
export type AdminWorkoutEditableStatus = z.infer<typeof adminWorkoutEditableStatusSchema>;
export type AdminCalendarWorkout = z.infer<typeof adminCalendarWorkoutSchema>;
export type AdminCalendarDay = z.infer<typeof adminCalendarDaySchema>;
export type AdminCalendarSummary = z.infer<typeof adminCalendarSummarySchema>;
export type AdminCalendarSummaryDay = z.infer<typeof adminCalendarSummaryDaySchema>;
export type AdminCreateWorkoutInput = z.infer<typeof adminCreateWorkoutSchema>;
export type AdminUpdateWorkoutInput = z.infer<typeof adminUpdateWorkoutSchema>;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createApiClient({ baseUrl }: ApiClientOptions) {
  return async function request<TResponse>(
    input: string,
    init?: RequestInit,
  ): Promise<TResponse> {
    const response = await fetch(`${baseUrl}${input}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => null)) as ApiErrorShape | null;
      throw new ApiClientError(
        errorBody?.message || `Request failed with status ${response.status}`,
        response.status,
        errorBody?.code,
        errorBody,
      );
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    /**
     * Mutating endpoints answer with an empty body, and not all of them use
     * 204. Reading the text first keeps those responses from throwing
     * "Unexpected end of JSON input" after a request that actually succeeded.
     */
    const body = await response.text();

    return (body ? JSON.parse(body) : undefined) as TResponse;
  };
}
