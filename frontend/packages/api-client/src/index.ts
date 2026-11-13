import * as contract from "./generated/zod.gen";
import { z } from "zod";

export { z };

export interface ApiClientOptions {
  baseUrl: string;
}

// --- Shared enums (from the generated contract) ---

export const workoutTypeSchema =
  contract.zTrainingWorkoutResponseDto.shape.type;
export const workoutStatusSchema =
  contract.zTrainingWorkoutResponseDto.shape.status;
export const WORKOUT_TYPES = workoutTypeSchema.options;
export const WORKOUT_STATUSES = workoutStatusSchema.options;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().nullable().optional(),
  referralCode: z.string().optional().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string().or(z.date()).optional(),
  permissions: z.array(z.string()).optional(),
  features: z
    .object({
      showReferral: z.boolean().default(false),
      theme: z.string().optional(),
    })
    .optional()
    .default({ showReferral: false }),
});

export const authTokensSchema = contract.zAuthTokensResponseDto;

/**
 * A session as the web app's browser code sees it: the BFF keeps both tokens
 * in httpOnly cookies and strips them from the body.
 */
export const browserSessionSchema = authTokensSchema.omit({
  accessToken: true,
  refreshToken: true,
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

export const USER_BIO_MAX_LENGTH = 300;

export const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  /** `null` removes the avatar. */
  avatarUrl: z.string().url().nullable().optional(),
  bio: z.string().max(USER_BIO_MAX_LENGTH).nullable().optional(),
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
export const avatarUploadSchema = contract.zAvatarUploadResponseDto;

export const mobileAuthEmailRequestSchema = z.object({
  email: z.string().email(),
});

export const mobileAuthEmailVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{4}$/),
});

export const mobileAuthChallengeSchema = contract.zEmailOtpChallengeResponseDto;

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
export type BrowserSession = z.infer<typeof browserSessionSchema>;
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

export const trainingAthleteSchema = contract.zTrainingAthleteResponseDto;

export const hrZonesMethodSchema = z.enum(["threshold", "max_hr", "custom"]);
export const timeOfDaySchema = z.enum(["morning", "day", "evening", "any"]);
export const athleteSexSchema = z.enum(["female", "male"]);
export const experienceLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);
export const trainingWeekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const hrZoneSchema = contract.zHrZoneResponseDto;

export const profileCompletenessSchema =
  contract.zProfileCompletenessResponseDto;

/** `GET/PATCH /athletes/me`: stored inputs plus values the server derives from them. */
export const athleteProfileSchema = contract.zAthleteProfileResponseDto;

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
    allowDoubles: z.boolean(),
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

export const gearSchema = contract.zGearResponseDto;

export const gearListSchema = contract.zGearListResponseDto;

export const gearTypeSchema = z.enum(["shoes", "watch", "sensor"]);
export const gearDataSourceSchema = z.enum([
  "strava",
  "garmin",
  "apple_health",
  "health_connect",
]);

export const gearInputSchema = z.object({
  type: gearTypeSchema.optional(),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  nickname: z.string().trim().max(60).nullable().optional(),
  initialDistanceKm: z.number().min(0).max(10000).optional(),
  limitKm: z.number().int().min(100).max(2000).optional(),
  startedAt: z.string().nullable().optional(),
  defaultWorkoutTypes: z.array(workoutTypeSchema).optional(),
  replaceReminder: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  dataSource: gearDataSourceSchema.nullable().optional(),
});

export const gearImportResultSchema = contract.zGearImportResultDto;

export type GearType = z.infer<typeof gearTypeSchema>;
export type GearDataSource = z.infer<typeof gearDataSourceSchema>;
export type GearImportResult = z.infer<typeof gearImportResultSchema>;
export type GearStatus = z.infer<typeof gearStatusSchema>;
export type Gear = z.infer<typeof gearSchema>;
export type GearList = z.infer<typeof gearListSchema>;
export type GearInput = z.infer<typeof gearInputSchema>;

// --- Account and security ---

export const authSessionSchema = contract.zAuthSessionResponseDto;
export const authSessionListSchema = contract.zAuthSessionListResponseDto;
export const authIdentitySchema = contract.zAuthIdentityResponseDto;
export const authIdentityListSchema = contract.zAuthIdentityListResponseDto;
export const emailChangeChallengeSchema =
  contract.zEmailChangeChallengeResponseDto;
export const dataExportSchema = contract.zDataExportResponseDto;
export const dataExportStatusSchema = contract.zDataExportStatusResponseDto;

export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthIdentity = z.infer<typeof authIdentitySchema>;
export type EmailChangeChallenge = z.infer<typeof emailChangeChallengeSchema>;
export type DataExport = z.infer<typeof dataExportSchema>;

// --- User preferences ---

export const coachAdaptationModeSchema = z.enum(["auto", "confirm", "suggest"]);

export const quietHoursSchema = contract.zQuietHoursDto;

export const userPreferencesSchema = contract.zUserPreferencesResponseDto;

export const userPreferencesUpdateSchema = contract.zUpdateUserPreferencesDto;

export type CoachAdaptationMode = z.infer<typeof coachAdaptationModeSchema>;

/** Adaptation of the active plan waiting for the user (`proposed`) or shown as advice (`suggested`). */
export const pendingAdaptationSchema = contract.zTrainingAdaptationResponseDto;
export const pendingAdaptationListSchema =
  contract.zTrainingAdaptationListResponseDto;
export type PendingAdaptation = z.infer<typeof pendingAdaptationSchema>;
export type QuietHours = z.infer<typeof quietHoursSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type UserPreferencesUpdate = z.infer<typeof userPreferencesUpdateSchema>;

export const trainingStateSchema = contract.zTrainingStateResponseDto;

export const trainingWorkoutAnalysisSchema =
  contract.zTrainingWorkoutAnalysisResponseDto;

export const trainingWorkoutSchema = contract.zTrainingWorkoutResponseDto;

/** Body of `PATCH /workouts/:id`: a workout added by hand (plan workouts change via the plan). */
export const updateWorkoutSchema = contract.zUpdateWorkoutDto;
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;

export const trainingPlanWeekSchema = contract.zTrainingPlanWeekResponseDto;

export const trainingPlanSchema = contract.zTrainingPlanResponseDto;

export type TrainingAthlete = z.infer<typeof trainingAthleteSchema>;
export type TrainingState = z.infer<typeof trainingStateSchema>;
export type TrainingWorkout = z.infer<typeof trainingWorkoutSchema>;
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;
export type TrainingWorkoutAnalysis = z.infer<
  typeof trainingWorkoutAnalysisSchema
>;

export const createWorkoutSchema = z.object({
  scheduledAt: z.string(),
  type: workoutTypeSchema.optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  durationMinutes: z.number().optional(),
  distanceKm: z.number().optional(),
  /** One goal of a workout added by hand; only its value is stored, the other stays 0. */
  goal: z.enum(["none", "duration", "distance"]).optional(),
  /** Distance goal only: finish within this many minutes (sets the pace corridor). */
  timeLimitMin: z.number().optional(),
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
export type WorkoutGoal = NonNullable<CreateWorkoutInput["goal"]>;
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>;

// --- Training Goals Taxonomy & Universal Goal Model ---

export const ATHLETE_GOAL_TYPES = [
  // Race & Event
  "prepare_for_race",
  "improve_race_result",
  "run_new_distance",
  "trail_preparation",
  "ultra_preparation",
  "backyard_preparation",
  // Performance
  "improve_speed",
  "improve_pace",
  "build_endurance",
  "improve_aerobic_fitness",
  "improve_hills",
  // Training habit
  "start_running",
  "return_to_running",
  "build_consistency",
  "increase_running_volume",
  "run_continuously",
  // Fitness & Lifestyle
  "lose_weight",
  "maintain_fitness",
  "general_health",
  // Challenge
  "complete_challenge",
  // Flexible
  "custom",
] as const;

export type AthleteGoalType = (typeof ATHLETE_GOAL_TYPES)[number];

export const ATHLETE_GOAL_CATEGORIES = [
  "race_event",
  "performance",
  "training_habit",
  "fitness_lifestyle",
  "challenge",
  "flexible",
] as const;

export type AthleteGoalCategory = (typeof ATHLETE_GOAL_CATEGORIES)[number];

export const GOAL_TYPE_CATEGORY: Record<AthleteGoalType, AthleteGoalCategory> =
  {
    prepare_for_race: "race_event",
    improve_race_result: "race_event",
    run_new_distance: "race_event",
    trail_preparation: "race_event",
    ultra_preparation: "race_event",
    backyard_preparation: "race_event",
    improve_speed: "performance",
    improve_pace: "performance",
    build_endurance: "performance",
    improve_aerobic_fitness: "performance",
    improve_hills: "performance",
    start_running: "training_habit",
    return_to_running: "training_habit",
    build_consistency: "training_habit",
    increase_running_volume: "training_habit",
    run_continuously: "training_habit",
    lose_weight: "fitness_lifestyle",
    maintain_fitness: "fitness_lifestyle",
    general_health: "fitness_lifestyle",
    complete_challenge: "challenge",
    custom: "flexible",
  };

export const GOAL_METRIC_KEYS = [
  "distanceMeters",
  "finishTimeSec",
  "paceSecondsPerKm",
  "weightKg",
  "runsPerWeek",
  "weeklyDistanceKm",
  "weeklyDurationMinutes",
  "continuousDurationMinutes",
  "continuousDistanceKm",
  "elevationGainMeters",
  "shortDistanceResultSec",
  "benchmarkValue",
  "timeOnFeetMinutes",
  "loopsCount",
  "challengeMetric",
  "challengeTargetValue",
  "challengePeriod",
  "challengeProgressValue",
] as const;

export type GoalMetricKey = (typeof GOAL_METRIC_KEYS)[number];

export type GoalChallengeMetric =
  | "total_distance"
  | "total_duration"
  | "runs_count"
  | "active_days";
export type GoalChallengePeriod =
  | "this_week"
  | "this_month"
  | "this_year"
  | "custom";

export const GOAL_CHALLENGE_METRICS: readonly GoalChallengeMetric[] = [
  "total_distance",
  "total_duration",
  "runs_count",
  "active_days",
];

export const GOAL_CHALLENGE_PERIODS: readonly GoalChallengePeriod[] = [
  "this_week",
  "this_month",
  "this_year",
  "custom",
];

export const GOAL_METRIC_BOUNDS: Record<
  GoalMetricKey,
  { min: number; max: number; integer?: boolean }
> = {
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
  distance: ["distanceMeters"],
  finishTime: ["finishTimeSec"],
  pace: ["paceSecondsPerKm"],
  weight: ["weightKg"],
  runsPerWeek: ["runsPerWeek"],
  weeklyVolume: ["weeklyDistanceKm", "weeklyDurationMinutes"],
  continuous: ["continuousDurationMinutes", "continuousDistanceKm"],
};

const RACE_CURRENT: readonly GoalMetricKey[] = [
  "distanceMeters",
  "finishTimeSec",
  "paceSecondsPerKm",
];

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
    targetFields: ["distanceMeters", "elevationGainMeters"],
    currentFields: [
      "distanceMeters",
      "elevationGainMeters",
      "weeklyDistanceKm",
    ],
    requiredTargetGroups: [T.distance],
  },
  ultra_preparation: {
    targetFields: ["distanceMeters", "elevationGainMeters"],
    currentFields: ["distanceMeters", "weeklyDistanceKm"],
    requiredTargetGroups: [T.distance],
  },
  backyard_preparation: {
    targetFields: ["loopsCount", "timeOnFeetMinutes", "distanceMeters"],
    currentFields: ["timeOnFeetMinutes", "distanceMeters"],
    requiredTargetGroups: [],
  },
  improve_speed: {
    targetFields: [
      "shortDistanceResultSec",
      "paceSecondsPerKm",
      "benchmarkValue",
    ],
    currentFields: [
      "shortDistanceResultSec",
      "paceSecondsPerKm",
      "benchmarkValue",
    ],
    requiredTargetGroups: [],
  },
  improve_pace: {
    targetFields: [...T.pace, "distanceMeters"],
    currentFields: [...T.pace, ...T.distance],
    requiredTargetGroups: [T.pace],
  },
  build_endurance: {
    targetFields: [...T.continuous],
    currentFields: [
      "continuousDurationMinutes",
      "continuousDistanceKm",
      "distanceMeters",
    ],
    requiredTargetGroups: [T.continuous],
  },
  improve_aerobic_fitness: {
    targetFields: ["benchmarkValue"],
    currentFields: ["benchmarkValue"],
    requiredTargetGroups: [],
  },
  improve_hills: {
    targetFields: ["elevationGainMeters", "continuousDurationMinutes"],
    currentFields: ["elevationGainMeters", "benchmarkValue"],
    requiredTargetGroups: [],
  },
  start_running: {
    targetFields: ["continuousDurationMinutes", "continuousDistanceKm"],
    currentFields: ["continuousDurationMinutes", "continuousDistanceKm"],
    requiredTargetGroups: [],
  },
  return_to_running: {
    targetFields: ["weeklyDistanceKm", "continuousDurationMinutes"],
    currentFields: [
      "weeklyDistanceKm",
      "continuousDurationMinutes",
      "continuousDistanceKm",
    ],
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
    targetFields: ["runsPerWeek", "weeklyDistanceKm"],
    currentFields: ["runsPerWeek", "weeklyDistanceKm"],
    requiredTargetGroups: [],
  },
  general_health: {
    targetFields: ["runsPerWeek", "weeklyDurationMinutes"],
    currentFields: ["runsPerWeek"],
    requiredTargetGroups: [],
  },
  complete_challenge: {
    targetFields: [
      "challengeMetric",
      "challengeTargetValue",
      "challengePeriod",
    ],
    currentFields: ["challengeProgressValue"],
    requiredTargetGroups: [
      ["challengeMetric", "challengeTargetValue"] as readonly GoalMetricKey[],
    ],
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
    return { valid: false, code: "GOAL_TYPE_UNKNOWN" };
  }

  if (
    config.requiresDescription &&
    !(
      typeof goal.description === "string" && goal.description.trim().length > 0
    )
  ) {
    return { valid: false, code: "GOAL_DESCRIPTION_REQUIRED" };
  }

  const target = goal.target ?? {};

  for (const group of config.requiredTargetGroups) {
    const satisfied = group.some((field) => {
      const value = target[field];
      return value !== undefined && value !== null && value !== "";
    });
    if (!satisfied) {
      return { valid: false, code: "GOAL_TARGET_REQUIRED", field: group[0] };
    }
  }

  return { valid: true };
}

export const athleteGoalTypeSchema = z.enum(ATHLETE_GOAL_TYPES);
export const athleteGoalCategorySchema = z.enum(ATHLETE_GOAL_CATEGORIES);

export const athleteGoalPayloadSchema = z.object({
  type: athleteGoalTypeSchema,
  current: z.record(z.string(), z.unknown()).optional(),
  target: z.record(z.string(), z.unknown()).optional(),
  description: z.string().max(2000).optional(),
  targetDate: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

export type AthleteGoalPayloadInput = z.infer<typeof athleteGoalPayloadSchema>;

export const LEGACY_RACE_DISTANCE_METERS: Record<string, number> = {
  "5k": 5_000,
  "10k": 10_000,
  half_marathon: 21_097,
  marathon: 42_195,
};

export const LEGACY_RACE_DISTANCE_VALUES = [
  "5k",
  "10k",
  "half_marathon",
  "marathon",
  "just_running",
] as const;

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
    return {
      type: "improve_race_result",
      target: { ...target, finishTimeSec: targetTimeSeconds },
    };
  }
  return { type: "prepare_for_race", target };
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
  const targetTimeSeconds =
    typeof finishTimeSec === "number" && Number.isFinite(finishTimeSec)
      ? finishTimeSec
      : null;

  if (typeof distanceMeters === "number") {
    const matched = Object.entries(LEGACY_RACE_DISTANCE_METERS).find(
      ([, meters]) => Math.abs(meters - distanceMeters) < 1,
    );
    if (matched) {
      return {
        raceDistance:
          matched[0] as (typeof LEGACY_RACE_DISTANCE_VALUES)[number],
        targetTimeSeconds,
      };
    }
  }

  return { raceDistance: "just_running", targetTimeSeconds };
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

export const activePlanSummarySchema = contract.zActivePlanSummaryDto;

export const planStartOptionKindSchema = z.enum([
  "today",
  "next_monday",
  "race_aligned",
]);

export const planStartOptionSchema = contract.zStartOptionDto;

export const planStartOptionsSchema = contract.zStartOptionsResponseDto;

export const planStartBlockSchema = z.object({
  startDate: z.string(),
  goalTargetDate: z.string().optional(),
  replaceActive: z.boolean(),
  timezone: z.string().optional(),
});

export const recentResultSchema = contract.zRecentResultDto;

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
export const metricsSnapshotSchema = contract.zMetricsSnapshotDto;

export const metricsSourceSchema = contract.zSourcedNumberDto.shape.source;

export const currentMetricsSchema = contract.zCurrentMetricsDto;

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
  type: athleteGoalTypeSchema,
  current: z.record(z.string(), z.unknown()).optional(),
  target: z.record(z.string(), z.unknown()).optional(),
  description: z.string().max(2000).optional(),
  targetDate: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  // Legacy fields kept for backward compatibility
  raceDistance: z
    .enum(["5k", "10k", "half_marathon", "marathon", "just_running"])
    .optional(),
  targetTimeSeconds: z.number().int().nonnegative().optional(),
});

export const manualPlanScheduleSchema = z.object({
  trainingDays: z.array(z.number().int().min(0).max(6)).min(1),
  preferredLongRunDay: z.number().int().min(0).max(6).optional(),
  workoutDurationMinutes: z.number().int().positive().optional(),
});

export const manualPlanStructureSchema = z.object({
  totalWeeks: z.number().int().min(4).max(16),
  sessionsPerWeek: z.number().int().min(1).max(7),
  focus: contract.zManualPlanStructureDto.shape.focus,
});

export const manualPlanPreviewWorkoutSchema =
  contract.zManualPlanPreviewWorkoutDto;

export const manualPlanPreviewWeekSchema = contract.zManualPlanPreviewWeekDto;

export const manualPlanPreviewSchema = contract.zManualPlanPreviewResponseDto;

export const manualPlanWorkoutOverrideSchema = z.object({
  id: z.string(),
  type: workoutTypeSchema.optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  distanceKm: z.number().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

export const manualPlanNewWorkoutSchema = z.object({
  type: workoutTypeSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  distanceKm: z.number().positive().optional(),
  durationMinutes: z.number().int().positive(),
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

export const createManualPlanSchema = previewManualPlanSchema
  .extend({
    startDate: z.string().optional(),
    weekOverrides: z.array(manualPlanWeekOverridesSchema).optional(),
  })
  .extend(planSaveFieldsSchema.shape);

export type ManualPlanGoalInput = z.infer<typeof manualPlanGoalSchema>;
export type ManualPlanScheduleInput = z.infer<typeof manualPlanScheduleSchema>;
export type ManualPlanStructureInput = z.infer<
  typeof manualPlanStructureSchema
>;
export type ManualPlanPreviewWorkout = z.infer<
  typeof manualPlanPreviewWorkoutSchema
>;
export type ManualPlanPreviewWeek = z.infer<typeof manualPlanPreviewWeekSchema>;

/**
 * Relative plan structures keep the engine phase as a plain lowercase string;
 * the dated preview types it (weeks in upper case, as the backend renders them).
 */
export function previewWorkoutPhase(
  phase: string,
): ManualPlanPreviewWorkout["phase"] {
  const parsed = manualPlanPreviewWorkoutSchema.shape.phase.safeParse(
    phase.toLowerCase(),
  );
  return parsed.success ? parsed.data : "base";
}

export function previewWeekPhase(
  phase: string,
): ManualPlanPreviewWeek["phase"] {
  const parsed = manualPlanPreviewWeekSchema.shape.phase.safeParse(
    phase.toUpperCase(),
  );
  return parsed.success ? parsed.data : "BASE";
}
export type ManualPlanPreview = z.infer<typeof manualPlanPreviewSchema>;
export type ManualPlanWorkoutOverride = z.infer<
  typeof manualPlanWorkoutOverrideSchema
>;
export type ManualPlanNewWorkout = z.infer<typeof manualPlanNewWorkoutSchema>;
export type ManualPlanWeekOverrides = z.infer<
  typeof manualPlanWeekOverridesSchema
>;
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

export const planWeekSchema = contract.zPlanWeekDto;

export const currentWeekContextSchema = contract.zCurrentWeekContextDto;

export const planAdaptationTypeSchema = z.enum([
  "HIGH_FATIGUE",
  "MISSED_WORKOUT",
  "POOR_PERFORMANCE",
  "EXCELLENT_PERFORMANCE",
  "LOW_RECOVERY",
  "SCHEDULE_CHANGE",
  "GOAL_CHANGE",
]);

export const planAdaptationSchema = contract.zPlanAdaptationDto;

/** Goal as codes and numbers; the apps build its title in the app language. */
export const planGoalSchema = contract.zPlanGoalSummaryDto;

export const planKeySessionSchema = contract.zKeySessionDto;

export const planStatusSchema = z.enum([
  "not_started",
  "active",
  "completed",
  "cancelled",
]);

/** Creation parameters of a plan; AI plans may store only part of them. */
export const planConfigSchema = contract.zPlanConfigDto;

export const planOverviewSchema = contract.zPlanOverviewResponseDto;

export type PlanPhase = z.infer<typeof planPhaseSchema>;
export type PlanWeekStatus = z.infer<typeof planWeekStatusSchema>;
export type PlanWeek = z.infer<typeof planWeekSchema>;
export type CurrentWeekContext = z.infer<typeof currentWeekContextSchema>;
export type PlanAdaptationType = z.infer<typeof planAdaptationTypeSchema>;
export type PlanAdaptation = z.infer<typeof planAdaptationSchema>;
export type PlanGoal = z.infer<typeof planGoalSchema>;
export type PlanGoalTarget = NonNullable<PlanGoal["target"]>;
export type PlanKeySession = z.infer<typeof planKeySessionSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type PlanOverview = z.infer<typeof planOverviewSchema>;
export type PlanConfig = z.infer<typeof planConfigSchema>;

// --- Plans library: drafts, active plan, history ---

export const planLifecycleStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "cancelled",
  "paused",
]);
export const planListGroupSchema = z.enum(["draft", "active", "history"]);

export const planGoalSummarySchema = contract.zPlanGoalSummaryDto;

export const planStatsSchema = contract.zPlanStatsDto;

export const planListItemSchema = contract.zPlanListItemDto;

export const planListResponseSchema = contract.zPlanListResponseDto;

export const planCountsSchema = contract.zPlanCountsResponseDto;

export const activePlanResponseSchema = contract.zActivePlanResponseDto;

/** Workout of a relative (undated) draft week; `dayOfWeek`: 0 = Monday. */
export const relativeWorkoutSchema = contract.zRelativeWorkoutDto;

export const relativeWeekSchema = contract.zRelativeWeekDto;

/** Week record of a plan: relative on drafts, dated (workoutIds) otherwise. */
export const planDetailsWeekSchema = contract.zPlanDetailsWeekDto;

export const planWorkoutItemSchema = contract.zPlanWorkoutItemDto;

export const planDetailsSchema = contract.zPlanDetailsDto;

export const planMetaResponseSchema = contract.zPlanMetaResponseDto;

export const planVersionResponseSchema = contract.zPlanVersionResponseDto;

export const cancelPlanResponseSchema = contract.zCancelPlanResponseDto;

export const updatePlanMetaSchema = z.object({
  name: z.string().trim().min(1).max(PLAN_NAME_MAX_LENGTH).optional(),
  notes: z.string().max(PLAN_NOTES_MAX_LENGTH).nullable().optional(),
  expectedVersion: z.number().int().min(0),
});

/** Draft structure edits; workouts are addressed by their relative key. */
export const draftWorkoutOverrideSchema = z.object({
  key: z.string(),
  type: workoutTypeSchema.optional(),
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
  type: workoutTypeSchema.optional(),
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

export const planDiffAdjustmentSchema = contract.zPlanDiffAdjustmentDto;

export const planDiffWorkoutSchema = contract.zPlanDiffWorkoutDto;

export const planDiffWeekSchema = contract.zPlanDiffWeekDto;

export const planDiffSchema = contract.zPlanDiffDto;

export const planChangePreviewSchema = contract.zPlanChangesPreviewResponseDto;

// "Prepare again" (rebuild)

export const rebuildPrefillSchema = contract.zRebuildPrefillResponseDto;

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

export const rebuildPreviewSchema = contract.zRebuildPreviewResponseDto;

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
export type UpdatePlanStructureInput = z.infer<
  typeof updatePlanStructureSchema
>;
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

export const coachSessionSchema = contract.zCoachSessionResponseDto;

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

export const coachChatResponseSchema = contract.zCoachChatResponseDto;

export const coachSessionDetailSchema = contract.zCoachSessionDetailResponseDto;

export const createCoachSessionSchema = z.object({
  athleteId: z.string(),
  title: z.string().optional(),
});

export const sendCoachMessageSchema = z.object({
  message: z.string(),
});

export const coachWorkoutNoteSchema = contract.zCoachWorkoutNoteResponseDto;

export type CoachSession = z.infer<typeof coachSessionSchema>;
export type CoachWorkoutNote = z.infer<typeof coachWorkoutNoteSchema>;
export type CoachMessage = z.infer<typeof coachMessageSchema>;
export type CoachChatResponse = z.infer<typeof coachChatResponseSchema>;
export type CoachSessionDetail = z.infer<typeof coachSessionDetailSchema>;
export type CreateCoachSessionInput = z.infer<typeof createCoachSessionSchema>;
export type SendCoachMessageInput = z.infer<typeof sendCoachMessageSchema>;

// --- Progress ---

export const progressPeriodKeySchema = z.enum(["4W", "8W", "3M", "6M", "1Y"]);
export const recordDistanceSchema = z.enum([
  "1k",
  "5k",
  "10k",
  "half_marathon",
  "marathon",
]);
export const capabilityTypeSchema = z.enum([
  "endurance",
  "threshold",
  "speed",
  "recovery",
  "consistency",
]);
export const trendSchema = z.enum(["up", "down", "stable"]);

export const progressGoalSchema = contract.zGoalProgressDto;

export const recordBestSchema = contract.zRecordBestDto;

export const progressRecordSchema = contract.zRecordDto;

export const progressOverviewSchema = contract.zProgressOverviewResponseDto;

export const progressMetricSchema = contract.zProgressMetricResponseDto;

export const progressRecordsSchema = contract.zProgressRecordsResponseDto;

export const progressSummarySchema = contract.zProgressSummaryResponseDto;

export const recordAttemptSchema = contract.zRecordAttemptDto;

export const recordHistorySchema = contract.zRecordHistoryResponseDto;

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
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
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

export const integrationItemSchema = contract.zIntegrationItemResponseDto;

export const stravaProfileAccessSchema =
  contract.zStravaProfileAccessResponseDto;
export type StravaProfileAccess = z.infer<typeof stravaProfileAccessSchema>;

export const integrationsListSchema = contract.zIntegrationsListResponseDto;

export const stravaConnectResponseSchema = contract.zStravaConnectResponseDto;

export const integrationSyncStatusSchema =
  contract.zIntegrationSyncStatusResponseDto;

export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type IntegrationItem = z.infer<typeof integrationItemSchema>;
export type IntegrationsList = z.infer<typeof integrationsListSchema>;
export type StravaConnectResponse = z.infer<typeof stravaConnectResponseSchema>;
export type IntegrationSyncStatus = z.infer<typeof integrationSyncStatusSchema>;

// --- Device integrations (Apple Health, Health Connect) ---

export const deviceProviderSchema = z.enum(["apple_health", "health_connect"]);
export type DeviceProvider = z.infer<typeof deviceProviderSchema>;

export const deviceScopeSchema = z.enum([
  "workouts",
  "heart_rate",
  "distance",
  "elevation",
  "steps",
  "calories",
  "weight",
  "height",
  "resting_heart_rate",
  "history",
  "background",
]);
export type DeviceScope = z.infer<typeof deviceScopeSchema>;

export const deviceSyncTypeSchema = z.enum([
  "initial",
  "foreground",
  "background",
  "manual",
  "backfill",
]);
export type DeviceSyncType = z.infer<typeof deviceSyncTypeSchema>;

export type DeviceConnectionRequest = {
  platform: "ios" | "android";
  deviceId: string;
  osVersion?: string;
  appVersion?: string;
  grantedScopes?: DeviceScope[];
  historyDepthDays?: number;
  profileSync?: boolean;
};

export type DeviceConnectionUpdate = Partial<
  Pick<
    DeviceConnectionRequest,
    "osVersion" | "appVersion" | "grantedScopes" | "profileSync"
  >
>;

/** A run read on the device, in the shape the backend accepts. */
export type DeviceActivity = {
  sourceActivityId: string;
  type: "run" | "trail_run" | "treadmill";
  startedAt: string;
  endedAt: string;
  utcOffsetMinutes?: number;
  durationSec: number;
  elapsedTimeSec?: number;
  distanceMeters: number;
  elevationGainMeters?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  cadence?: number;
  calories?: number;
  originAppId?: string;
  originDevice?: string;
};

export type DeviceSyncBatchRequest = {
  syncId: string;
  batchIndex: number;
  syncType: DeviceSyncType;
  isLast: boolean;
  activities: DeviceActivity[];
  deletedSourceActivityIds: string[];
};

export const deviceSyncBatchAcceptedSchema =
  contract.zDeviceSyncBatchAcceptedDto;
export type DeviceSyncBatchAccepted = z.infer<
  typeof deviceSyncBatchAcceptedSchema
>;

export const deviceSyncCountersSchema = contract.zDeviceSyncCountersDto;
export type DeviceSyncCounters = z.infer<typeof deviceSyncCountersSchema>;

export const deviceSyncStatusSchema = contract.zDeviceSyncStatusResponseDto;
export type DeviceSyncStatus = z.infer<typeof deviceSyncStatusSchema>;

export type DeviceProfileMetricsRequest = {
  weight?: { valueKg: number; measuredAt: string; originAppId?: string };
  height?: { valueCm: number; measuredAt: string; originAppId?: string };
  /** iOS only: HealthKit characteristics. */
  sex?: "female" | "male" | "other";
  birthDate?: string;
  restingHeartRate?: Array<{ date: string; bpm: number }>;
};

export const deviceProfileMetricsResultSchema =
  contract.zDeviceProfileMetricsResultDto;
export type DeviceProfileMetricsResult = z.infer<
  typeof deviceProfileMetricsResultSchema
>;

export const workoutSourcesSchema = contract.zWorkoutSourcesResponseDto;
export type WorkoutSources = z.infer<typeof workoutSourcesSchema>;

// --- Consents ---

export const consentTypeSchema = z.enum(["health_data"]);
export type ConsentType = z.infer<typeof consentTypeSchema>;

export const consentSchema = contract.zConsentResponseDto;
export type Consent = z.infer<typeof consentSchema>;

export const consentsListSchema = contract.zConsentsListResponseDto;
export type ConsentsList = z.infer<typeof consentsListSchema>;

// --- Admin: shared ---

export const paginationMetaSchema = contract.zPaginationMetaDto;

export const adminUserSchema = contract.zUserResponseDto;

export const adminUserGroupSchema = contract.zAdminUserGroupDto;

export const adminUserPermissionSchema = contract.zAdminUserPermissionDto;

export const adminUserDetailSchema = contract.zAdminUserResponseDto;

export const permissionSchema = contract.zPermissionResponseDto;

/** The complete, unpaginated permission catalog. */
export const permissionCatalogSchema = z.array(permissionSchema);

/**
 * Member projection returned by the group detail endpoint. The backend loads
 * group members with a restricted attribute set (`id`, `firstName`,
 * `lastName`, `email`, `isSystem`), so this intentionally does not reuse
 * `adminUserSchema`, which models the full admin user resource.
 */
export const permissionGroupMemberSchema = contract.zPermissionGroupMemberDto;

export const permissionGroupSchema = contract.zPermissionGroupResponseDto;

export const appSettingsSchema = contract.zSettingsResponseDto;

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
  sortBy: z
    .enum(["createdAt", "email", "firstName", "lastName"])
    .default("createdAt"),
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
  status: contract.zAdminUserResponseDto.shape.status.optional(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Presence answer: which of the requested users hold a live connection.
 *
 * A subset of what was asked for, never a full list of everybody online — the
 * caller only ever asks about rows it is already allowed to see.
 */
export const userPresenceSchema = contract.zUserPresenceResponseDto;
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

export const adminWorkoutEditableStatusSchema = z.enum(
  ADMIN_WORKOUT_EDITABLE_STATUSES,
);

export const adminCalendarWorkoutSchema = contract.zAdminWorkoutResponseDto;

export const adminCalendarDaySchema = contract.zAdminCalendarDayResponseDto;

export const adminCalendarSummaryDaySchema =
  contract.zAdminCalendarSummaryDayDto;

export const adminCalendarSummarySchema =
  contract.zAdminCalendarSummaryResponseDto;

export const adminWorkoutMutationSchema =
  contract.zAdminWorkoutMutationResponseDto;

const adminWorkoutTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(ADMIN_WORKOUT_LIMITS.titleMaxLength);

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

// --- Tracker ---

export const recordingEnvironmentSchema = z.enum([
  "outdoor",
  "trail",
  "treadmill",
]);
export type RecordingEnvironment = z.infer<typeof recordingEnvironmentSchema>;
/** `mixed` — GPS with stretches counted by the pedometer while the signal was lost. */
export const distanceSourceSchema = z.enum([
  "gps",
  "pedometer",
  "manual",
  "mixed",
]);
export type DistanceSource = z.infer<typeof distanceSourceSchema>;

export const executionStepSchema = contract.zExecutionStepDto;
export type ExecutionStep = z.infer<typeof executionStepSchema>;

export const workoutExecutionSchema = contract.zWorkoutExecutionResponseDto;
export type WorkoutExecution = z.infer<typeof workoutExecutionSchema>;

export const recordedSplitSchema = contract.zRecordedSplitDto;
export type RecordedSplit = z.infer<typeof recordedSplitSchema>;

export const recordedLapSchema = contract.zRecordedLapDto;
export type RecordedLap = z.infer<typeof recordedLapSchema>;

export const recordedPauseSchema = contract.zRecordedPauseDto;
export type RecordedPause = z.infer<typeof recordedPauseSchema>;

export const routeBoundsSchema = contract.zRouteBoundsDto;
export type RouteBounds = z.infer<typeof routeBoundsSchema>;

/** Body of `POST /recorded-activities` (the `summary` part of the multipart request). */
export type RecordedActivityRequest = {
  clientSessionId: string;
  environment: RecordingEnvironment;
  distanceSource: DistanceSource;
  plannedWorkoutId?: string | null;
  /** False keeps a free run apart from the day's unfinished planned workout. */
  linkPlanned?: boolean;
  workoutType?: Exclude<WorkoutType, "rest"> | null;
  startedAt: string;
  endedAt: string;
  utcOffsetMinutes?: number;
  elapsedSec: number;
  movingSec: number;
  distanceM: number;
  measuredDistanceM?: number | null;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  avgPaceSecPerKm?: number | null;
  bestPaceSecPerKm?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  avgCadence?: number | null;
  splits?: RecordedSplit[];
  laps?: RecordedLap[];
  pauses?: RecordedPause[];
  routeLine?: string | null;
  routeBounds?: RouteBounds | null;
  startPoint?: { lat: number; lng: number } | null;
  gearId?: string | null;
  feeling?: number | null;
  rpe?: number | null;
  notes?: string | null;
  device: {
    platform: "ios" | "android";
    osVersion?: string;
    appVersion?: string;
    model?: string;
  };
};

export const recordedActivityAcceptedSchema =
  contract.zRecordedActivityAcceptedDto;
export type RecordedActivityAccepted = z.infer<
  typeof recordedActivityAcceptedSchema
>;

export const workoutRecordingSchema = contract.zWorkoutRecordingResponseDto;
export type WorkoutRecording = z.infer<typeof workoutRecordingSchema>;
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>;
export type AdminWorkoutEditableStatus = z.infer<
  typeof adminWorkoutEditableStatusSchema
>;
export type AdminCalendarWorkout = z.infer<typeof adminCalendarWorkoutSchema>;
export type AdminCalendarDay = z.infer<typeof adminCalendarDaySchema>;
export type AdminCalendarSummary = z.infer<typeof adminCalendarSummarySchema>;
export type AdminCalendarSummaryDay = z.infer<
  typeof adminCalendarSummaryDaySchema
>;
export type AdminCreateWorkoutInput = z.infer<typeof adminCreateWorkoutSchema>;
export type AdminUpdateWorkoutInput = z.infer<typeof adminUpdateWorkoutSchema>;

// --- Admin: user control (activity, account, overview, workouts, coach) ---

export const activityItemSchema = contract.zActivityItemDto;
export const activityPageSchema = contract.zActivityPageDto;
export const adminOverviewSchema = contract.zAdminOverviewResponseDto;
export const accountSecuritySchema = contract.zAccountSecurityResponseDto;
export const blockUserSchema = contract.zBlockUserDto;
export const userBlockReasonSchema = contract.zBlockUserDto.shape.reason;
export const userStatusSchema =
  contract.zAccountSecurityResponseDto.shape.status;
export const adminEmailChangeSchema = contract.zAdminEmailChangeDto;
export const adminCoachSessionListSchema =
  contract.zAdminCoachSessionListResponseDto;
export const adminCoachNoteListSchema = contract.zAdminCoachNoteListResponseDto;
export const deviceSyncRequestSchema = contract.zDeviceSyncRequestResponseDto;
export const trainingWorkoutCompletionSchema =
  contract.zTrainingWorkoutCompletionResponseDto;
export const raceResultSchema = contract.zRaceResultResponseDto;
export const recordsExclusionSchema = contract.zRecordsExclusionResponseDto;
export const workoutGearAssignmentSchema = contract.zWorkoutGearAssignmentDto;

export const USER_BLOCK_REASONS = userBlockReasonSchema.options;
export const USER_STATUSES = userStatusSchema.options;

export type ActivityItem = z.infer<typeof activityItemSchema>;
export type ActivityPage = z.infer<typeof activityPageSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
export type AccountSecurity = z.infer<typeof accountSecuritySchema>;
export type BlockUserInput = z.infer<typeof blockUserSchema>;
export type UserBlockReason = z.infer<typeof userBlockReasonSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type AdminCoachSessionList = z.infer<typeof adminCoachSessionListSchema>;
export type AdminCoachNoteList = z.infer<typeof adminCoachNoteListSchema>;
export type TrainingWorkoutCompletion = z.infer<
  typeof trainingWorkoutCompletionSchema
>;
export type RaceResult = z.infer<typeof raceResultSchema>;

// --- Notifications ---

/**
 * Inbox entries. `category` and `type` stay open strings on the client: an
 * older app must keep showing the inbox when the backend adds a new kind.
 */
export const notificationSchema = contract.zNotificationResponseDto.extend({
  category: z.string(),
  type: z.string(),
});
export const notificationPageSchema = z.object({
  data: z.array(notificationSchema),
  meta: paginationMetaSchema,
});
export const notificationUnreadCountSchema =
  contract.zNotificationUnreadCountResponseDto;
export const pushDeviceSchema = contract.zPushDeviceResponseDto;
export const pushDeviceListSchema = contract.zPushDeviceListResponseDto;
export const adminNotificationSchema =
  contract.zAdminNotificationResponseDto.extend({
    category: z.string(),
    type: z.string(),
  });
export const adminNotificationPageSchema = z.object({
  data: z.array(adminNotificationSchema),
  meta: paginationMetaSchema,
});
export const broadcastSchema = contract.zBroadcastResponseDto;
export const broadcastPageSchema = z.object({
  data: z.array(broadcastSchema),
  meta: paginationMetaSchema,
});
export const broadcastRecipientSchema = contract.zBroadcastRecipientResponseDto;
export const broadcastRecipientPageSchema = z.object({
  data: z.array(broadcastRecipientSchema),
  meta: paginationMetaSchema,
});
export const audiencePreviewSchema = contract.zAudiencePreviewResponseDto;

export const NOTIFICATION_CATEGORIES =
  contract.zNotificationResponseDto.shape.category.options;
export const NOTIFICATION_LINK_TARGETS =
  contract.zNotificationLinkDto.shape.target.options;
export const NOTIFICATION_CHANNELS =
  contract.zNotificationDeliveryResponseDto.shape.channel.options;
export const NOTIFICATION_DELIVERY_STATUSES =
  contract.zNotificationDeliveryResponseDto.shape.status.options;
export const BROADCAST_AUDIENCE_TYPES =
  contract.zBroadcastAudienceDto.shape.type.options;
export const BROADCAST_STATUSES = broadcastSchema.shape.status.options;
export const PUSH_PLATFORMS = pushDeviceSchema.shape.platform.options;

/** Bounds mirrored from the backend broadcast DTOs. */
export const BROADCAST_LIMITS = {
  titleMaxLength: 120,
  bodyMaxLength: 2000,
  urlMaxLength: 500,
  usersMax: 1000,
} as const;

const broadcastTextSchema = z.object({
  title: z.string().trim().max(BROADCAST_LIMITS.titleMaxLength).nullish(),
  body: z.string().trim().min(1).max(BROADCAST_LIMITS.bodyMaxLength),
});

export const broadcastAudienceInputSchema = z.object({
  type: z.enum(BROADCAST_AUDIENCE_TYPES),
  userIds: z.array(z.uuid()).max(BROADCAST_LIMITS.usersMax).optional(),
  groupId: z.uuid().optional(),
  segment: z
    .object({
      languages: z.array(z.enum(["ru", "en"])).optional(),
      platforms: z.array(z.enum(PUSH_PLATFORMS)).optional(),
      registeredFrom: z.string().optional(),
      registeredTo: z.string().optional(),
      activePlan: z.boolean().optional(),
    })
    .optional(),
});

export const createBroadcastSchema = z.object({
  audience: broadcastAudienceInputSchema,
  content: z.object({
    ru: broadcastTextSchema.optional(),
    en: broadcastTextSchema.optional(),
  }),
  link: z
    .object({
      target: z.enum(NOTIFICATION_LINK_TARGETS),
      id: z.uuid().nullish(),
      url: z.url().max(BROADCAST_LIMITS.urlMaxLength).nullish(),
    })
    .nullish(),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationPage = z.infer<typeof notificationPageSchema>;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationLink = NonNullable<Notification["link"]>;
export type NotificationLinkTarget = (typeof NOTIFICATION_LINK_TARGETS)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];
export type PushDevice = z.infer<typeof pushDeviceSchema>;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];
export type AdminNotification = z.infer<typeof adminNotificationSchema>;
export type AdminNotificationPage = z.infer<typeof adminNotificationPageSchema>;
export type Broadcast = z.infer<typeof broadcastSchema>;
export type BroadcastPage = z.infer<typeof broadcastPageSchema>;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];
export type BroadcastAudienceType = (typeof BROADCAST_AUDIENCE_TYPES)[number];
export type BroadcastRecipient = z.infer<typeof broadcastRecipientSchema>;
export type BroadcastRecipientPage = z.infer<
  typeof broadcastRecipientPageSchema
>;
export type AudiencePreview = z.infer<typeof audiencePreviewSchema>;
export type BroadcastAudienceInput = z.infer<
  typeof broadcastAudienceInputSchema
>;
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
export type RegisterPushDeviceInput = {
  token: string;
  platform: PushPlatform;
  locale?: string | null;
  appVersion?: string | null;
  deviceName?: string | null;
};

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

// --- Admin: analytics dashboard ---

export const analyticsSummarySchema = contract.zAnalyticsSummaryResponseDto;
export const analyticsActivitySchema = contract.zAnalyticsActivityResponseDto;
export const analyticsEngagementSchema =
  contract.zAnalyticsEngagementResponseDto;
export const analyticsOutcomesSchema = contract.zAnalyticsOutcomesResponseDto;
export const analyticsPlansSchema = contract.zAnalyticsPlansResponseDto;
export const analyticsCoachSchema = contract.zAnalyticsCoachResponseDto;
export const analyticsAudienceSchema = contract.zAnalyticsAudienceResponseDto;
export const analyticsAttentionSchema = contract.zAnalyticsAttentionResponseDto;
export const analyticsAttentionTypeSchema =
  contract.zAnalyticsAttentionItemDto.shape.type;
export const analyticsAttentionSeveritySchema =
  contract.zAnalyticsAttentionItemDto.shape.severity;

export const ANALYTICS_ATTENTION_TYPES = analyticsAttentionTypeSchema.options;
export const ANALYTICS_PERIODS =
  contract.zAnalyticsControllerSummaryV1Query.shape.period
    .unwrap()
    .unwrap().options;
export const ANALYTICS_RANGES = analyticsActivitySchema.shape.range.options;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
export type AnalyticsRange = z.infer<typeof analyticsActivitySchema>["range"];
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;
export type AnalyticsKpi = AnalyticsSummary["planAdherence"];
export type AnalyticsActivity = z.infer<typeof analyticsActivitySchema>;
export type AnalyticsEngagement = z.infer<typeof analyticsEngagementSchema>;
export type AnalyticsOutcomes = z.infer<typeof analyticsOutcomesSchema>;
export type AnalyticsPlans = z.infer<typeof analyticsPlansSchema>;
export type AnalyticsCoach = z.infer<typeof analyticsCoachSchema>;
export type AnalyticsAudience = z.infer<typeof analyticsAudienceSchema>;
export type AnalyticsAttention = z.infer<typeof analyticsAttentionSchema>;
export type AnalyticsAttentionItem = AnalyticsAttention["data"][number];
export type AnalyticsAttentionType = z.infer<
  typeof analyticsAttentionTypeSchema
>;
export type AnalyticsAttentionSeverity = z.infer<
  typeof analyticsAttentionSeveritySchema
>;
