import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type {
  AdaptationEventView,
  AthleteStateView,
  AthleteView,
  GoalView,
  TrainingPlanView,
  WorkoutAnalysisView,
  WorkoutView,
} from '../interfaces/training-views.interface';

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

export class TrainingAthleteResponseDto implements AthleteView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional({ nullable: true })
  age!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sex!: AthleteView['sex'];

  @ApiPropertyOptional({ nullable: true })
  heightCm!: number | null;

  @ApiPropertyOptional({ nullable: true })
  weightKg!: number | null;

  @ApiProperty()
  experienceLevel!: string;

  @ApiPropertyOptional({ nullable: true })
  weeklyMileageKm!: number | null;

  @ApiProperty()
  sessionsPerWeek!: number;

  @ApiProperty({ type: [Object] })
  recentRaceResults!: Array<Record<string, unknown>>;

  @ApiProperty({ type: [String] })
  preferredTrainingDays!: string[];

  @ApiProperty({ type: [String] })
  availableTrainingDays!: string[];

  @ApiPropertyOptional({ nullable: true })
  preferredWorkoutDurationMinutes!: number | null;

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

  @ApiPropertyOptional({ nullable: true })
  thresholdPaceSecondsPerKm!: number | null;

  @ApiPropertyOptional({ nullable: true })
  thresholdHeartRate!: number | null;

  @ApiPropertyOptional({ nullable: true })
  vo2max!: number | null;

  @ApiProperty()
  weeklyLoad!: number;

  @ApiProperty()
  acuteLoad!: number;

  @ApiProperty()
  chronicLoad!: number;

  @ApiPropertyOptional({ nullable: true })
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

export class TrainingGoalResponseDto implements GoalView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiProperty({ description: 'Universal goal type discriminator' })
  type!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Object,
    description: 'Type-specific metric payload { current?, target?, description? }',
  })
  payload!: GoalView['payload'];

  @ApiProperty()
  raceDistance!: GoalView['raceDistance'];

  @ApiPropertyOptional({ nullable: true })
  targetTimeSeconds!: number | null;

  @ApiPropertyOptional({ nullable: true })
  targetDate!: string | null;

  @ApiProperty()
  priority!: number;

  @ApiProperty()
  status!: GoalView['status'];

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ nullable: true })
  goalId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  planId!: string | null;

  @ApiProperty()
  weekNumber!: number;

  @ApiProperty()
  scheduledAt!: Date;

  @ApiProperty()
  type!: WorkoutView['type'];

  @ApiProperty()
  phase!: string;

  @ApiProperty()
  status!: WorkoutView['status'];

  @ApiProperty()
  orderInWeek!: number;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  distanceKm!: number;

  @ApiProperty({ type: Object })
  target!: Record<string, unknown>;

  @ApiProperty({ type: [Object] })
  steps!: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  actual!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: TrainingWorkoutAnalysisResponseDto, nullable: true })
  analysis!: WorkoutAnalysisView | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: Date | null;

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

  @ApiPropertyOptional({ nullable: true })
  goalId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Version to pass as expectedVersion when editing the plan' })
  version!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Null for drafts' })
  startDate!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Null for drafts' })
  endDate!: string | null;

  @ApiProperty()
  trainingFrequency!: number;

  @ApiProperty()
  weeklyTargetKm!: number;

  @ApiProperty()
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

  @ApiPropertyOptional({ nullable: true })
  planId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  workoutId!: string | null;

  @ApiProperty()
  type!: AdaptationEventView['type'];

  @ApiProperty({ type: Object })
  input!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  decision!: Record<string, unknown>;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  createdAt!: Date;
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
