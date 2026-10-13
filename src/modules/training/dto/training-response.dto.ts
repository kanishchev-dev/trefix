import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

import type {
  AdaptationEventView,
  AthleteStateView,
  AthleteView,
  GoalView,
  TrainingPlanView,
  WorkoutAnalysisView,
  WorkoutView,
} from '../interfaces/training-views.interface';
import {
  ADAPTATION_EVENT_STATUSES,
  ATHLETE_GOAL_STATUSES,
  ATHLETE_SEX_VALUES,
  FIELD_SOURCES,
  HR_ZONES_METHODS,
  TIMES_OF_DAY,
  TRAINING_PLAN_STATUSES,
  WORKOUT_STATUSES,
  WORKOUT_TYPES,
} from '../training.constants';

export class TrainingWorkoutAnalysisResponseDto implements WorkoutAnalysisView {
  @ApiProperty()
  completion!: number;

  @ApiProperty()
  performanceDelta!: number;

  @ApiProperty()
  load!: number;

  @ApiProperty()
  expectedLoad!: number;

  @ApiProperty({ enum: ['low', 'moderate', 'high'] })
  fatigueImpact!: 'low' | 'moderate' | 'high';

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  analysisVersion!: string;
}

/** Where a profile field value came from. */
export class FieldSourceDto {
  @ApiProperty({ enum: FIELD_SOURCES })
  source!: (typeof FIELD_SOURCES)[number];

  @ApiProperty()
  updatedAt!: string;
}

@ApiExtraModels(FieldSourceDto)
export class TrainingAthleteResponseDto implements AthleteView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: Number, nullable: true })
  age!: number | null;

  @ApiProperty({ enum: ATHLETE_SEX_VALUES, nullable: true })
  sex!: AthleteView['sex'];

  @ApiProperty({ type: Number, nullable: true })
  heightCm!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  weightKg!: number | null;

  @ApiProperty()
  experienceLevel!: string;

  @ApiProperty({ type: Number, nullable: true })
  weeklyMileageKm!: number | null;

  @ApiProperty()
  sessionsPerWeek!: number;

  @ApiProperty({ type: [Object] })
  recentRaceResults!: Array<Record<string, unknown>>;

  @ApiProperty({ type: [String] })
  preferredTrainingDays!: string[];

  @ApiProperty({ type: [String] })
  availableTrainingDays!: string[];

  @ApiProperty({ type: Number, nullable: true })
  preferredWorkoutDurationMinutes!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '1992-03-14' })
  birthDate!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 52 })
  restingHeartRate!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 189 })
  maxHeartRate!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: null })
  thresholdHeartRate!: number | null;

  @ApiProperty({ enum: HR_ZONES_METHODS, example: 'max_hr' })
  hrZonesMethod!: AthleteView['hrZonesMethod'];

  @ApiProperty({ type: [Number], nullable: true })
  hrZonesCustom!: number[] | null;

  @ApiProperty({ type: Number, nullable: true, example: 2021 })
  runningSinceYear!: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: '`null` — not answered, empty string — no limitations',
  })
  limitations!: string | null;

  @ApiProperty({ enum: TIMES_OF_DAY, example: 'morning' })
  preferredTimeOfDay!: AthleteView['preferredTimeOfDay'];

  @ApiProperty({ type: String, nullable: true, example: 'saturday' })
  longRunDay!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 120 })
  longRunMaxDurationMinutes!: number | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(FieldSourceDto) },
    example: { weightKg: { source: 'strava', updatedAt: '2026-10-05T07:12:00Z' } },
    description: 'Provenance of fields an external source may fill in; manual values are never overwritten',
  })
  fieldSources!: AthleteView['fieldSources'];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TrainingStateResponseDto implements AthleteStateView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiProperty()
  fitness!: number;

  @ApiProperty()
  fatigue!: number;

  @ApiProperty()
  form!: number;

  @ApiProperty({ type: Number, nullable: true })
  thresholdPaceSecondsPerKm!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  thresholdHeartRate!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  vo2max!: number | null;

  @ApiProperty()
  weeklyLoad!: number;

  @ApiProperty()
  acuteLoad!: number;

  @ApiProperty()
  chronicLoad!: number;

  @ApiProperty({ type: Number, nullable: true })
  recoveryScore!: number | null;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  source!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class GoalPayloadResponseDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  current?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  target?: Record<string, unknown>;

  @ApiPropertyOptional()
  description?: string;
}

export class TrainingGoalResponseDto implements GoalView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiProperty({ description: 'Universal goal type discriminator' })
  type!: string;

  @ApiPropertyOptional({ type: GoalPayloadResponseDto, nullable: true, description: 'Type-specific metric payload' })
  payload!: GoalView['payload'];

  @ApiProperty({ type: String })
  raceDistance!: GoalView['raceDistance'];

  @ApiPropertyOptional({ type: Number, nullable: true })
  targetTimeSeconds!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  targetDate!: string | null;

  @ApiProperty()
  priority!: number;

  @ApiProperty({ enum: ATHLETE_GOAL_STATUSES })
  status!: GoalView['status'];

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TrainingWorkoutResponseDto implements WorkoutView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiProperty({ type: String, nullable: true })
  goalId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  planId!: string | null;

  @ApiProperty()
  weekNumber!: number;

  @ApiProperty()
  scheduledAt!: Date;

  @ApiProperty({ enum: WORKOUT_TYPES })
  type!: WorkoutView['type'];

  @ApiProperty()
  phase!: string;

  @ApiProperty({ enum: WORKOUT_STATUSES })
  status!: WorkoutView['status'];

  @ApiProperty()
  orderInWeek!: number;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  distanceKm!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  target!: Record<string, unknown>;

  @ApiProperty({ type: [Object] })
  steps!: Array<Record<string, unknown>>;

  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  actual!: Record<string, unknown> | null;

  @ApiProperty({ type: TrainingWorkoutAnalysisResponseDto, nullable: true })
  analysis!: WorkoutAnalysisView | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Gear (shoes) used for the workout' })
  gearId?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TrainingPlanWeekResponseDto {
  @ApiProperty()
  weekNumber!: number;

  @ApiProperty()
  phase!: string;

  @ApiProperty()
  weeklyLoadTarget!: number;

  @ApiProperty({ type: [String] })
  workoutIds!: string[];
}

export class TrainingPlanResponseDto implements TrainingPlanView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiProperty({ type: String, nullable: true })
  goalId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'User-given name; null means the app titles the plan by its goal',
  })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Version to pass as expectedVersion when editing the plan' })
  version!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Null for drafts' })
  startDate!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Null for drafts' })
  endDate!: string | null;

  @ApiProperty()
  trainingFrequency!: number;

  @ApiProperty()
  weeklyTargetKm!: number;

  @ApiProperty({ enum: TRAINING_PLAN_STATUSES })
  status!: TrainingPlanView['status'];

  @ApiProperty()
  algorithmVersion!: string;

  @ApiProperty({ type: [TrainingPlanWeekResponseDto] })
  weeks!: TrainingPlanWeekResponseDto[];

  @ApiProperty({ type: [TrainingWorkoutResponseDto] })
  workouts!: TrainingWorkoutResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TrainingAdaptationResponseDto implements AdaptationEventView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiProperty({ type: String, nullable: true })
  planId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  workoutId!: string | null;

  @ApiProperty({ type: String })
  type!: AdaptationEventView['type'];

  @ApiProperty({ type: 'object', additionalProperties: true })
  input!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  decision!: Record<string, unknown>;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  confidence!: number;

  @ApiPropertyOptional({ enum: ADAPTATION_EVENT_STATUSES, example: 'applied' })
  status?: AdaptationEventView['status'];

  @ApiProperty()
  createdAt!: Date;
}

export class TrainingAdaptationListResponseDto {
  @ApiProperty({ type: [TrainingAdaptationResponseDto] })
  items!: TrainingAdaptationResponseDto[];
}

export class TrainingWorkoutCompletionResponseDto {
  @ApiProperty({ type: TrainingWorkoutResponseDto })
  workout!: TrainingWorkoutResponseDto;

  @ApiProperty({ type: TrainingWorkoutAnalysisResponseDto })
  analysis!: TrainingWorkoutAnalysisResponseDto;

  @ApiProperty({ type: TrainingStateResponseDto })
  state!: TrainingStateResponseDto;

  @ApiProperty({ type: TrainingAdaptationResponseDto })
  adaptation!: TrainingAdaptationResponseDto;
}
