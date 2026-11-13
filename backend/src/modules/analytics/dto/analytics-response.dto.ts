import { ApiProperty } from '@nestjs/swagger';

import { PaginationMetaDto } from '@/common/dto/pagination.dto';
import { ATHLETE_GOAL_CATEGORIES } from '@/modules/training/goal-taxonomy';

import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  ATTENTION_SEVERITIES,
  ATTENTION_TYPES,
  type AttentionSeverity,
  type AttentionType,
  FIRST_WORKOUT_BUCKETS,
  PLAN_PROGRESS_BUCKETS,
  RACE_RESULT_BUCKETS,
} from '../analytics.constants';

/*
 * Responses of the analytics dashboard. Only codes and numbers: clients
 * translate every label. Percentages are 0–100 with one decimal.
 */

class GeneratedDto {
  @ApiProperty({ format: 'date-time', description: 'When the block was computed (it may come from cache)' })
  generatedAt!: string;
}

// ------------------------------------------------------------------ summary

export class AnalyticsKpiDto {
  @ApiProperty({ example: 1046 })
  value!: number;

  @ApiProperty({ example: 965, description: 'Value over the previous period of the same length' })
  previous!: number;

  @ApiProperty({ type: Number, nullable: true, example: 8.4, description: 'Change against the previous period, %' })
  deltaPct!: number | null;

  @ApiProperty({ type: Number, isArray: true, description: 'Values by day (by week for 12m) of the period' })
  spark!: number[];
}

export class AnalyticsRunnersKpiDto extends AnalyticsKpiDto {
  @ApiProperty({ example: 5, description: 'Weeks in a row the number has grown' })
  growthWeeks!: number;
}

export class AnalyticsGoalsKpiDto extends AnalyticsKpiDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 64,
    description: 'Achieved of goals finished in the period, %',
  })
  rate!: number | null;
}

export class AnalyticsNewUsersKpiDto extends AnalyticsKpiDto {
  @ApiProperty({ type: Number, nullable: true, example: 58, description: 'First workout within 14 days of sign-up, %' })
  activationRate!: number | null;
}

export class AnalyticsStickinessKpiDto extends AnalyticsKpiDto {
  @ApiProperty({ example: 412, description: 'Average daily active users of the period' })
  dau!: number;

  @ApiProperty({ example: 1330, description: 'Active users of the last 28 days' })
  mau!: number;
}

export class AnalyticsRecordsKpiDto extends AnalyticsKpiDto {
  @ApiProperty({ example: 41, description: 'First results on a distance (not counted as improvements)' })
  firsts!: number;
}

export class AnalyticsDistanceKpiDto extends AnalyticsKpiDto {
  @ApiProperty({ type: Number, nullable: true, example: 21, description: 'Median km of the last 7 days among runners' })
  weeklyMedianKm!: number | null;
}

export class AnalyticsCoachKpiDto extends AnalyticsKpiDto {
  @ApiProperty({ type: Number, nullable: true, example: 46, description: 'Proactive messages answered within 24 h, %' })
  proactiveReplyRate!: number | null;
}

export class AnalyticsSummaryResponseDto extends GeneratedDto {
  @ApiProperty({ type: () => AnalyticsRunnersKpiDto, description: 'Athletes with a workout in the last 7 days' })
  weeklyActiveRunners!: AnalyticsRunnersKpiDto;

  @ApiProperty({ type: () => AnalyticsKpiDto, description: 'Done of done + missed planned workouts, %' })
  planAdherence!: AnalyticsKpiDto;

  @ApiProperty({ type: () => AnalyticsGoalsKpiDto })
  goalsAchieved!: AnalyticsGoalsKpiDto;

  @ApiProperty({ type: () => AnalyticsNewUsersKpiDto })
  newUsers!: AnalyticsNewUsersKpiDto;

  @ApiProperty({ type: () => AnalyticsStickinessKpiDto, description: 'Average DAU / MAU, %' })
  stickiness!: AnalyticsStickinessKpiDto;

  @ApiProperty({ type: () => AnalyticsRecordsKpiDto, description: 'Improved personal records' })
  personalRecords!: AnalyticsRecordsKpiDto;

  @ApiProperty({ type: () => AnalyticsDistanceKpiDto, description: 'Distance of completed workouts, km' })
  distanceKm!: AnalyticsDistanceKpiDto;

  @ApiProperty({ type: () => AnalyticsCoachKpiDto, description: 'Users who wrote to the coach' })
  coachActiveUsers!: AnalyticsCoachKpiDto;
}

// ----------------------------------------------------------------- activity

export class AnalyticsActivityPointDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ example: 412 })
  activeUsers!: number;

  @ApiProperty({ example: 188, description: 'Athletes who completed a workout that day' })
  runners!: number;

  @ApiProperty({ example: 203 })
  workouts!: number;

  @ApiProperty({ example: 1904.2 })
  distanceKm!: number;
}

export class AnalyticsActivityResponseDto extends GeneratedDto {
  @ApiProperty({ enum: ANALYTICS_RANGES })
  range!: AnalyticsRange;

  @ApiProperty({ type: () => AnalyticsActivityPointDto, isArray: true })
  points!: AnalyticsActivityPointDto[];

  @ApiProperty({ example: 401.3 })
  averageActiveUsers!: number;

  @ApiProperty({ example: 188.1 })
  averageRunners!: number;
}

// --------------------------------------------------------------- engagement

export class AnalyticsRegularityDto {
  @ApiProperty({ example: 6, description: 'Weeks with a workout out of the last 8' })
  weeks!: number;

  @ApiProperty({ example: 112 })
  users!: number;
}

export class AnalyticsActiveDaysDto {
  @ApiProperty({ example: 12, description: 'Days with a workout out of the last 28' })
  days!: number;

  @ApiProperty({ example: 40 })
  users!: number;
}

export class AnalyticsCohortDto {
  @ApiProperty({ example: '2026-08-17', description: 'Monday of the registration week' })
  week!: string;

  @ApiProperty({ example: 52 })
  size!: number;

  @ApiProperty({ type: Number, isArray: true, description: 'Share with a workout in week 0, 1, … after sign-up, %' })
  retention!: number[];
}

export class AnalyticsHabitDto {
  @ApiProperty({ example: 182, description: 'First workout in the period shifted 4 weeks back' })
  startedRunning!: number;

  @ApiProperty({ example: 97, description: 'Of them trained in 3 of their first 4 weeks' })
  formedHabit!: number;

  @ApiProperty({ type: Number, nullable: true, example: 53.3 })
  rate!: number | null;
}

export class AnalyticsFirstWorkoutBucketDto {
  @ApiProperty({ enum: FIRST_WORKOUT_BUCKETS })
  bucket!: (typeof FIRST_WORKOUT_BUCKETS)[number];

  @ApiProperty({ example: 71 })
  users!: number;
}

export class AnalyticsTimeToFirstWorkoutDto {
  @ApiProperty({ type: Number, nullable: true, example: 31 })
  medianHours!: number | null;

  @ApiProperty({ type: () => AnalyticsFirstWorkoutBucketDto, isArray: true })
  buckets!: AnalyticsFirstWorkoutBucketDto[];
}

export class AnalyticsWeeklySourcesDto {
  @ApiProperty({ example: '2026-10-12' })
  week!: string;

  @ApiProperty({ example: 120, description: 'Recorded with the in-app tracker' })
  trefix!: number;

  @ApiProperty({ example: 90 })
  strava!: number;

  @ApiProperty({ example: 12 })
  garmin!: number;

  @ApiProperty({ example: 80 })
  appleHealth!: number;

  @ApiProperty({ example: 30 })
  healthConnect!: number;

  @ApiProperty({ example: 25, description: 'Entered by hand' })
  manual!: number;
}

export class AnalyticsWeekdayHourDto {
  @ApiProperty({ example: 1, description: '1 = Monday … 7 = Sunday, local time of the start' })
  weekday!: number;

  @ApiProperty({ example: 7 })
  hour!: number;

  @ApiProperty({ example: 120 })
  workouts!: number;
}

export class AnalyticsStickinessPointDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ example: 412 })
  dau!: number;

  @ApiProperty({ example: 902 })
  wau!: number;

  @ApiProperty({ example: 1330 })
  mau!: number;

  @ApiProperty({ type: Number, nullable: true, example: 31 })
  stickiness!: number | null;
}

export class AnalyticsEngagementResponseDto extends GeneratedDto {
  @ApiProperty({ type: () => AnalyticsRegularityDto, isArray: true })
  regularity!: AnalyticsRegularityDto[];

  @ApiProperty({ type: () => AnalyticsActiveDaysDto, isArray: true })
  activeDays!: AnalyticsActiveDaysDto[];

  @ApiProperty({
    type: () => AnalyticsCohortDto,
    isArray: true,
    description: 'Registration cohorts of the last 12 weeks',
  })
  cohorts!: AnalyticsCohortDto[];

  @ApiProperty({ type: () => AnalyticsHabitDto })
  habit!: AnalyticsHabitDto;

  @ApiProperty({ type: () => AnalyticsTimeToFirstWorkoutDto })
  timeToFirstWorkout!: AnalyticsTimeToFirstWorkoutDto;

  @ApiProperty({ type: () => AnalyticsWeeklySourcesDto, isArray: true })
  sources!: AnalyticsWeeklySourcesDto[];

  @ApiProperty({ type: () => AnalyticsWeekdayHourDto, isArray: true })
  whenTheyRun!: AnalyticsWeekdayHourDto[];

  @ApiProperty({ type: () => AnalyticsStickinessPointDto, isArray: true })
  stickinessSeries!: AnalyticsStickinessPointDto[];
}

// ----------------------------------------------------------------- outcomes

export class AnalyticsOpenGoalsDto {
  @ApiProperty({ example: 437 })
  onTrack!: number;

  @ApiProperty({ example: 177 })
  atRisk!: number;

  @ApiProperty({ example: 60 })
  noData!: number;
}

export class AnalyticsFinishedGoalsDto {
  @ApiProperty({ example: 37 })
  achieved!: number;

  @ApiProperty({ example: 14 })
  missed!: number;

  @ApiProperty({ example: 7 })
  abandoned!: number;

  @ApiProperty({ type: Number, nullable: true, example: 63.8 })
  rate!: number | null;
}

export class AnalyticsGoalCategoryDto {
  @ApiProperty({ enum: ATHLETE_GOAL_CATEGORIES })
  category!: string;

  @ApiProperty() onTrack!: number;
  @ApiProperty() atRisk!: number;
  @ApiProperty() noData!: number;
  @ApiProperty() achieved!: number;
  @ApiProperty() missed!: number;
  @ApiProperty() abandoned!: number;
}

export class AnalyticsGoalsDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-10-17',
    description: 'Day of the latest nightly snapshot',
  })
  snapshotDate!: string | null;

  @ApiProperty({ type: () => AnalyticsOpenGoalsDto, description: 'Goals still going on, as of the latest snapshot' })
  active!: AnalyticsOpenGoalsDto;

  @ApiProperty({
    type: () => AnalyticsFinishedGoalsDto,
    description: 'Goals that reached a final status in the period',
  })
  finished!: AnalyticsFinishedGoalsDto;

  @ApiProperty({ type: () => AnalyticsGoalCategoryDto, isArray: true })
  byCategory!: AnalyticsGoalCategoryDto[];
}

export class AnalyticsFunnelStepDto {
  @ApiProperty({ example: 'plan_started' })
  step!: string;

  @ApiProperty({ example: 1012 })
  count!: number;
}

export class AnalyticsRaceBucketDto {
  @ApiProperty({ enum: RACE_RESULT_BUCKETS })
  bucket!: (typeof RACE_RESULT_BUCKETS)[number];

  @ApiProperty({ example: 21 })
  count!: number;
}

export class AnalyticsFitnessPointDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ type: Number, nullable: true, example: -9 })
  thresholdPaceChangeMedianSec!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 4.2 })
  fitnessChangeMedianPct!: number | null;
}

export class AnalyticsFitnessDto {
  @ApiProperty({ example: 380, description: 'Athletes with 8 weeks of history and ≥1 workout a week' })
  athletes!: number;

  @ApiProperty({ example: 205, description: 'Threshold pace faster by 2+ s/km' })
  improved!: number;

  @ApiProperty({ example: 118 })
  stable!: number;

  @ApiProperty({ example: 57 })
  declined!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: -9,
    description: 'Median change over 8 weeks, s/km (negative = faster)',
  })
  thresholdPaceChangeMedianSec!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 4.2, description: 'Median change of fitness over 8 weeks, %' })
  fitnessChangeMedianPct!: number | null;

  @ApiProperty({ description: 'False when the series is not kept (counted with staff)' })
  historical!: boolean;

  @ApiProperty({ type: () => AnalyticsFitnessPointDto, isArray: true })
  series!: AnalyticsFitnessPointDto[];
}

export class AnalyticsRecordsWeekDto {
  @ApiProperty({ example: '2026-10-12' })
  week!: string;

  @ApiProperty({ example: 24 })
  improvements!: number;

  @ApiProperty({ example: 10 })
  firsts!: number;
}

export class AnalyticsRecordsDistanceDto {
  @ApiProperty({ example: '5k' })
  distance!: string;

  @ApiProperty({ example: 31 })
  improvements!: number;

  @ApiProperty({ example: 12 })
  firsts!: number;
}

export class AnalyticsRecordsDto {
  @ApiProperty({ example: 96 })
  improvements!: number;

  @ApiProperty({ example: 41 })
  firsts!: number;

  @ApiProperty({ type: () => AnalyticsRecordsWeekDto, isArray: true })
  weekly!: AnalyticsRecordsWeekDto[];

  @ApiProperty({ type: () => AnalyticsRecordsDistanceDto, isArray: true })
  byDistance!: AnalyticsRecordsDistanceDto[];
}

export class AnalyticsVolumeWeekDto {
  @ApiProperty({ example: '2026-10-12' })
  week!: string;

  @ApiProperty({ type: Number, nullable: true, example: 21 })
  medianKm!: number | null;

  @ApiProperty({ example: 820 })
  runners!: number;
}

export class AnalyticsSafetyPointDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ type: Number, nullable: true, example: 6.2 })
  share!: number | null;
}

export class AnalyticsSafetyDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 6.2,
    description: 'Athletes with acute / chronic load > 1.5, %',
  })
  currentShare!: number | null;

  @ApiProperty()
  historical!: boolean;

  @ApiProperty({ type: () => AnalyticsSafetyPointDto, isArray: true })
  series!: AnalyticsSafetyPointDto[];
}

export class AnalyticsOutcomesResponseDto extends GeneratedDto {
  @ApiProperty({ type: () => AnalyticsGoalsDto })
  goals!: AnalyticsGoalsDto;

  @ApiProperty({
    type: () => AnalyticsFunnelStepDto,
    isArray: true,
    description: 'Goals of the last 12 months: goal_set → plan_started → half_plan → plan_completed → goal_achieved',
  })
  goalFunnel!: AnalyticsFunnelStepDto[];

  @ApiProperty({ type: () => AnalyticsRaceBucketDto, isArray: true })
  raceResults!: AnalyticsRaceBucketDto[];

  @ApiProperty({ type: () => AnalyticsFitnessDto })
  fitness!: AnalyticsFitnessDto;

  @ApiProperty({ type: () => AnalyticsRecordsDto })
  records!: AnalyticsRecordsDto;

  @ApiProperty({ type: () => AnalyticsVolumeWeekDto, isArray: true })
  volume!: AnalyticsVolumeWeekDto[];

  @ApiProperty({ type: () => AnalyticsSafetyDto })
  safety!: AnalyticsSafetyDto;
}

// -------------------------------------------------------------------- plans

export class AnalyticsPlansCreatedDto {
  @ApiProperty({ example: '2026-10-12' })
  week!: string;

  @ApiProperty() ai!: number;
  @ApiProperty() manual!: number;

  @ApiProperty({ description: 'Prepared again from a past plan' })
  rebuild!: number;
}

export class AnalyticsPlanOutcomesDto {
  @ApiProperty({ example: 52 })
  completed!: number;

  @ApiProperty({ example: 38, description: 'Cancelled by the user or an administrator' })
  cancelled!: number;

  @ApiProperty({ example: 21, description: 'Cancelled because another plan was started' })
  replaced!: number;
}

export class AnalyticsPlanProgressBucketDto {
  @ApiProperty({ enum: PLAN_PROGRESS_BUCKETS, description: 'Share of the plan behind when it was cancelled' })
  bucket!: (typeof PLAN_PROGRESS_BUCKETS)[number];

  @ApiProperty({ example: 17 })
  plans!: number;
}

export class AnalyticsCancelReasonDto {
  @ApiProperty({ example: 'user' })
  reason!: string;

  @ApiProperty({ example: 30 })
  plans!: number;
}

export class AnalyticsPlanWeekAdherenceDto {
  @ApiProperty({ example: 6 })
  planWeek!: number;

  @ApiProperty({ type: Number, nullable: true, example: 68 })
  adherencePct!: number | null;

  @ApiProperty({ example: 240, description: 'Done + missed workouts behind the share' })
  workouts!: number;
}

export class AnalyticsGoalTypeDto {
  @ApiProperty({ example: 'prepare_for_race' })
  goalType!: string;

  @ApiProperty({ enum: ATHLETE_GOAL_CATEGORIES })
  category!: string;

  @ApiProperty({ example: 196 })
  goals!: number;
}

export class AnalyticsRaceDistanceDto {
  @ApiProperty({ example: 'half_marathon', description: '5k, 10k, half_marathon, marathon or other' })
  distance!: string;

  @ApiProperty({ example: 19 })
  races!: number;
}

export class AnalyticsUpcomingRacesDto {
  @ApiProperty({ example: 43 })
  total!: number;

  @ApiProperty({ type: () => AnalyticsRaceDistanceDto, isArray: true })
  byDistance!: AnalyticsRaceDistanceDto[];
}

export class AnalyticsAdaptationsDto {
  @ApiProperty() proposed!: number;
  @ApiProperty() applied!: number;
  @ApiProperty() dismissed!: number;

  @ApiProperty({ type: Number, nullable: true, example: 72 })
  acceptanceRate!: number | null;
}

export class AnalyticsPlansResponseDto extends GeneratedDto {
  @ApiProperty({ example: 612 })
  active!: number;

  @ApiProperty({ type: () => AnalyticsPlansCreatedDto, isArray: true })
  created!: AnalyticsPlansCreatedDto[];

  @ApiProperty({ type: () => AnalyticsPlanOutcomesDto })
  outcomes!: AnalyticsPlanOutcomesDto;

  @ApiProperty({ type: () => AnalyticsPlanProgressBucketDto, isArray: true })
  cancellationByProgress!: AnalyticsPlanProgressBucketDto[];

  @ApiProperty({ type: () => AnalyticsCancelReasonDto, isArray: true })
  cancelReasons!: AnalyticsCancelReasonDto[];

  @ApiProperty({ type: () => AnalyticsPlanWeekAdherenceDto, isArray: true })
  adherenceByPlanWeek!: AnalyticsPlanWeekAdherenceDto[];

  @ApiProperty({ type: () => AnalyticsGoalTypeDto, isArray: true })
  goalTypes!: AnalyticsGoalTypeDto[];

  @ApiProperty({ type: () => AnalyticsUpcomingRacesDto })
  upcomingRaces!: AnalyticsUpcomingRacesDto;

  @ApiProperty({ type: () => AnalyticsAdaptationsDto })
  adaptations!: AnalyticsAdaptationsDto;
}

// -------------------------------------------------------------------- coach

export class AnalyticsCoachMessagesDayDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty() userMessages!: number;
  @ApiProperty() coachReplies!: number;
  @ApiProperty() proactive!: number;
}

export class AnalyticsProactiveDto {
  @ApiProperty() sent!: number;
  @ApiProperty() replied24h!: number;

  @ApiProperty({ type: Number, nullable: true })
  replyRate!: number | null;
}

export class AnalyticsWorkoutNotesDayDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty() notes!: number;
}

export class AnalyticsWorkoutNotesDto {
  @ApiProperty() total!: number;

  @ApiProperty({ type: () => AnalyticsWorkoutNotesDayDto, isArray: true })
  daily!: AnalyticsWorkoutNotesDayDto[];
}

export class AnalyticsCoachEffectDto {
  @ApiProperty({ example: 'plan_adherence', description: 'plan_adherence, week4_retention or goals_achieved' })
  metric!: string;

  @ApiProperty({ type: Number, nullable: true, example: 84, description: 'Users with the coach on, %' })
  enabled!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 71, description: 'Users with the coach off, %' })
  disabled!: number | null;
}

export class AnalyticsLlmDayDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty({ example: 4.12 })
  costUsd!: number;

  @ApiProperty() calls!: number;
}

export class AnalyticsLlmBreakdownDto {
  @ApiProperty({ example: 'coach_reply', description: 'Feature or model' })
  key!: string;

  @ApiProperty() calls!: number;
  @ApiProperty() costUsd!: number;
  @ApiProperty() inputTokens!: number;
  @ApiProperty() outputTokens!: number;
}

export class AnalyticsLlmDto {
  @ApiProperty({ example: 121.4 })
  costUsd!: number;

  @ApiProperty({ type: Number, nullable: true, example: 0.31 })
  costPerActiveUserUsd!: number | null;

  @ApiProperty() calls!: number;
  @ApiProperty() inputTokens!: number;
  @ApiProperty() outputTokens!: number;

  @ApiProperty({ type: Number, nullable: true, example: 0.4 })
  failedShare!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 6800 })
  p95LatencyMs!: number | null;

  @ApiProperty({ type: () => AnalyticsLlmDayDto, isArray: true })
  daily!: AnalyticsLlmDayDto[];

  @ApiProperty({ type: () => AnalyticsLlmBreakdownDto, isArray: true })
  byFeature!: AnalyticsLlmBreakdownDto[];

  @ApiProperty({ type: () => AnalyticsLlmBreakdownDto, isArray: true })
  byModel!: AnalyticsLlmBreakdownDto[];
}

export class AnalyticsCoachResponseDto extends GeneratedDto {
  @ApiProperty({ type: Number, nullable: true, example: 81, description: 'Users with the coach switched on, %' })
  enabledShare!: number | null;

  @ApiProperty({ example: 388 })
  activeUsers!: number;

  @ApiProperty({ type: Number, nullable: true, example: 4.1, description: 'Median user messages per conversation' })
  messagesPerSession!: number | null;

  @ApiProperty({ type: () => AnalyticsCoachMessagesDayDto, isArray: true })
  messages!: AnalyticsCoachMessagesDayDto[];

  @ApiProperty({ type: () => AnalyticsProactiveDto })
  proactive!: AnalyticsProactiveDto;

  @ApiProperty({ type: () => AnalyticsWorkoutNotesDto })
  workoutNotes!: AnalyticsWorkoutNotesDto;

  @ApiProperty({ type: () => AnalyticsCoachEffectDto, isArray: true })
  effect!: AnalyticsCoachEffectDto[];

  @ApiProperty({ type: () => AnalyticsLlmDto })
  llm!: AnalyticsLlmDto;
}

// ----------------------------------------------------------------- audience

export class AnalyticsAudienceTotalsDto {
  @ApiProperty() users!: number;
  @ApiProperty() blocked!: number;
  @ApiProperty() newInPeriod!: number;
  @ApiProperty() deletedInPeriod!: number;
}

export class AnalyticsDailyUsersDto {
  @ApiProperty({ example: '2026-10-01' })
  date!: string;

  @ApiProperty() users!: number;
}

export class AnalyticsProviderUsersDto {
  @ApiProperty({ example: 'apple', description: 'Sign-in provider or `email`' })
  provider!: string;

  @ApiProperty() users!: number;
}

export class AnalyticsPlatformUsersDto {
  @ApiProperty({ example: 'ios' })
  platform!: string;

  @ApiProperty() users!: number;
}

export class AnalyticsAppVersionDto {
  @ApiProperty({ example: 'ios' })
  platform!: string;

  @ApiProperty({ type: String, nullable: true, example: '1.6.0' })
  appVersion!: string | null;

  @ApiProperty() users!: number;
}

export class AnalyticsIntegrationDto {
  @ApiProperty({ example: 'strava' })
  provider!: string;

  @ApiProperty() connected!: number;
  @ApiProperty() errors!: number;
}

export class AnalyticsExperienceDto {
  @ApiProperty({ example: 'beginner' })
  level!: string;

  @ApiProperty() athletes!: number;
}

export class AnalyticsLanguageDto {
  @ApiProperty({ example: 'ru', description: 'Interface language or `system`' })
  language!: string;

  @ApiProperty() users!: number;
}

export class AnalyticsAudienceResponseDto extends GeneratedDto {
  @ApiProperty({ type: () => AnalyticsAudienceTotalsDto })
  totals!: AnalyticsAudienceTotalsDto;

  @ApiProperty({ type: () => AnalyticsDailyUsersDto, isArray: true })
  registrations!: AnalyticsDailyUsersDto[];

  @ApiProperty({ type: () => AnalyticsProviderUsersDto, isArray: true })
  registrationsByProvider!: AnalyticsProviderUsersDto[];

  @ApiProperty({
    type: () => AnalyticsFunnelStepDto,
    isArray: true,
    description: 'Users registered in the period: registered → … → habit',
  })
  activationFunnel!: AnalyticsFunnelStepDto[];

  @ApiProperty({
    type: () => AnalyticsPlatformUsersDto,
    isArray: true,
    description: 'Users active in the last 28 days',
  })
  platforms!: AnalyticsPlatformUsersDto[];

  @ApiProperty({ type: () => AnalyticsAppVersionDto, isArray: true })
  appVersions!: AnalyticsAppVersionDto[];

  @ApiProperty({ type: () => AnalyticsIntegrationDto, isArray: true })
  integrations!: AnalyticsIntegrationDto[];

  @ApiProperty({ type: Number, nullable: true, example: 63 })
  usersWithIntegrationShare!: number | null;

  @ApiProperty({ type: () => AnalyticsExperienceDto, isArray: true })
  experience!: AnalyticsExperienceDto[];

  @ApiProperty({ type: () => AnalyticsLanguageDto, isArray: true })
  languages!: AnalyticsLanguageDto[];
}

// ---------------------------------------------------------------- attention

export class AnalyticsAttentionUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;
}

export class AnalyticsAttentionDetailsDto {
  @ApiProperty({ type: Number, required: false }) daysWithoutWorkout?: number;
  @ApiProperty({ type: String, required: false }) planId?: string;
  @ApiProperty({ type: String, required: false, nullable: true }) planName?: string | null;
  @ApiProperty({ type: Number, required: false, description: 'Acute / chronic load' }) ratio?: number;
  @ApiProperty({ type: String, required: false }) goalId?: string;
  @ApiProperty({ type: String, required: false }) goalType?: string;
  @ApiProperty({ type: String, required: false, nullable: true }) targetDate?: string | null;
  @ApiProperty({ type: Number, required: false, nullable: true }) progressPct?: number | null;
  @ApiProperty({ type: String, required: false }) provider?: string;
  @ApiProperty({ type: String, required: false }) status?: string;
  @ApiProperty({ type: Number, required: false }) hoursSinceSync?: number;
  @ApiProperty({ type: Number, required: false }) failures?: number;
  @ApiProperty({ type: String, isArray: true, required: false }) channels?: string[];
  @ApiProperty({ type: String, required: false }) exportId?: string;
}

export class AnalyticsAttentionItemDto {
  @ApiProperty({ enum: ATTENTION_TYPES })
  type!: AttentionType;

  @ApiProperty({ enum: ATTENTION_SEVERITIES })
  severity!: AttentionSeverity;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Since when the problem lasts' })
  since!: string | null;

  @ApiProperty({ type: () => AnalyticsAttentionUserDto })
  user!: AnalyticsAttentionUserDto;

  @ApiProperty({ type: () => AnalyticsAttentionDetailsDto })
  details!: AnalyticsAttentionDetailsDto;
}

export class AnalyticsAttentionCountDto {
  @ApiProperty({ enum: ATTENTION_TYPES })
  type!: AttentionType;

  @ApiProperty() count!: number;
}

export class AnalyticsAttentionResponseDto extends GeneratedDto {
  @ApiProperty({ type: () => AnalyticsAttentionCountDto, isArray: true })
  counts!: AnalyticsAttentionCountDto[];

  @ApiProperty({ type: () => AnalyticsAttentionItemDto, isArray: true })
  data!: AnalyticsAttentionItemDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
