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
export type AuthRequestEmailVerificationInput = z.infer<
  typeof authRequestEmailVerificationSchema
>;
export type AuthVerifyEmailInput = z.infer<typeof authVerifyEmailSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
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
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

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
  startDate: z.string(),
  endDate: z.string(),
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

// --- Manual Plan Creation ---

export const manualPlanGoalSchema = z.object({
  raceDistance: z.enum(["5k", "10k", "half_marathon", "marathon", "just_running"]),
  targetTimeSeconds: z.number().int().positive().optional(),
  targetDate: z.string().optional(),
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
});

export const createManualPlanSchema = previewManualPlanSchema.extend({
  startDate: z.string().optional(),
  weekOverrides: z.array(manualPlanWeekOverridesSchema).optional(),
});

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
]);

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

export const progressPeriodSchema = z.enum(["4W", "8W", "3M", "6M", "1Y"]);

export const progressFormStatusSchema = z.enum([
  "BUILDING",
  "MAINTAINING",
  "RECOVERING",
  "PEAK",
  "TAPERING",
]);

export const progressTrendSchema = z.enum([
  "IMPROVING",
  "STABLE",
  "DECLINING",
]);

export const progressFormSchema = z.object({
  fitness: z.number(),
  fatigue: z.number(),
  form: z.number(),
  status: progressFormStatusSchema,
  trend: progressTrendSchema,
  change: z.number(),
  periodComparison: z.string().optional(),
});

export const progressGoalTypeSchema = z.enum([
  "RACE_TIME",
  "DISTANCE",
  "PACE",
  "CONSISTENCY",
  "CUSTOM",
]);

export const progressGoalStatusSchema = z.enum([
  "ON_TRACK",
  "IMPROVING",
  "BEHIND",
  "ACHIEVED",
  "NO_LONGER_ACTIVE",
]);

export const progressGoalSchema = z.object({
  type: progressGoalTypeSchema,
  title: z.string().optional(),
  distance: z.union([z.string(), z.number()]).optional(),
  target: z.string(),
  currentEstimate: z.string(),
  delta: z.string(),
  progress: z.number().optional(),
  status: progressGoalStatusSchema,
  targetDate: z.string().optional(),
});

export const progressCapabilityTypeSchema = z.enum([
  "ENDURANCE",
  "SPEED",
  "THRESHOLD",
  "RECOVERY",
  "CONSISTENCY",
]);

export const progressCapabilityTrendSchema = z.enum(["UP", "STABLE", "DOWN"]);

export const progressCapabilitySchema = z.object({
  type: progressCapabilityTypeSchema,
  name: z.string().optional(),
  value: z.number(),
  change: z.number(),
  trend: progressCapabilityTrendSchema,
  period: z.string().optional(),
  description: z.string().optional(),
  currentMetric: z.string().optional(),
  previousMetric: z.string().optional(),
  trainingFactors: z.array(z.string()).optional(),
});

export const progressPerformancePointSchema = z.object({
  date: z.string(),
  value: z.number(),
  label: z.string().optional(),
});

export const progressPerformanceMetricKeySchema = z.enum([
  "distance",
  "pace",
  "heartRate",
  "trainingLoad",
  "elevation",
]);

export const progressPerformanceMetricSchema = z.object({
  metric: progressPerformanceMetricKeySchema,
  title: z.string(),
  currentValue: z.string(),
  previousValue: z.string().optional(),
  comparableContext: z.string().optional(),
  changePercent: z.number().optional(),
  unit: z.string(),
  dataPoints: z.array(progressPerformancePointSchema),
});

export const progressMilestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  value: z.string(),
  date: z.string(),
  previousBest: z.string().optional(),
  change: z.string().optional(),
  context: z.string().optional(),
  workoutId: z.string().optional(),
  category: z.string().optional(),
});

export const progressTrainingImpactFactorSchema = z.object({
  name: z.string(),
  percentage: z.number(),
  description: z.string().optional(),
});

export const progressTrainingImpactSchema = z.object({
  title: z.string(),
  description: z.string(),
  factors: z.array(progressTrainingImpactFactorSchema),
});

export const progressSnapshotSchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
    periodKey: progressPeriodSchema,
  }),
  form: progressFormSchema,
  goal: progressGoalSchema.nullable().optional(),
  capabilities: z.array(progressCapabilitySchema),
  performance: z.array(progressPerformanceMetricSchema),
  milestones: z.array(progressMilestoneSchema),
  trainingImpact: progressTrainingImpactSchema.nullable().optional(),
});

export type ProgressPeriod = z.infer<typeof progressPeriodSchema>;
export type ProgressFormStatus = z.infer<typeof progressFormStatusSchema>;
export type ProgressTrend = z.infer<typeof progressTrendSchema>;
export type ProgressForm = z.infer<typeof progressFormSchema>;
export type ProgressGoalType = z.infer<typeof progressGoalTypeSchema>;
export type ProgressGoalStatus = z.infer<typeof progressGoalStatusSchema>;
export type ProgressGoal = z.infer<typeof progressGoalSchema>;
export type ProgressCapabilityType = z.infer<typeof progressCapabilityTypeSchema>;
export type ProgressCapabilityTrend = z.infer<typeof progressCapabilityTrendSchema>;
export type ProgressCapability = z.infer<typeof progressCapabilitySchema>;
export type ProgressPerformancePoint = z.infer<typeof progressPerformancePointSchema>;
export type ProgressPerformanceMetricKey = z.infer<typeof progressPerformanceMetricKeySchema>;
export type ProgressPerformanceMetric = z.infer<typeof progressPerformanceMetricSchema>;
export type ProgressMilestone = z.infer<typeof progressMilestoneSchema>;
export type ProgressTrainingImpactFactor = z.infer<typeof progressTrainingImpactFactorSchema>;
export type ProgressTrainingImpact = z.infer<typeof progressTrainingImpactSchema>;
export type ProgressSnapshot = z.infer<typeof progressSnapshotSchema>;

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
});

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

    return (await response.json()) as TResponse;
  };
}
