import { z } from "zod";

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
