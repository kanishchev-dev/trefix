import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { WORKOUT_TYPES } from '../../training.constants';
import type {
  SummaryComparisonView,
  SummaryGoalView,
  SummaryMonthView,
  SummaryPlanExecutionView,
  SummaryPlanKeyWorkoutView,
  SummaryPlanView,
  SummaryTotalsView,
  SummaryWorkoutView,
  SummaryYearView,
} from '../progress-summary.views';

/** OpenAPI description of the progress summary; every class implements the view it documents. */

const SUMMARY_WORKOUT_TYPES = WORKOUT_TYPES.filter((type) => type !== 'rest');
const WORKOUT_STATUSES = ['plan', 'free', 'missed'] as const;
const REGULARITY_DAYS = ['run', 'rest', 'missed', 'future'] as const;
const INSIGHT_CODES = ['easy_pace_faster', 'volume_steady'] as const;

export class ProgressSummaryQueryDto {
  @ApiPropertyOptional({
    example: 'Europe/Moscow',
    description: 'IANA timezone used for local days, weeks and months; UTC when omitted',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class SummaryWorkoutDto implements SummaryWorkoutView {
  @ApiProperty({ type: String, nullable: true, description: 'Null for a missed plan workout' })
  id!: string | null;

  @ApiProperty({ example: '2026-10-15', description: 'Local calendar day' })
  date!: string;

  @ApiProperty({ enum: SUMMARY_WORKOUT_TYPES })
  type!: SummaryWorkoutView['type'];

  @ApiProperty({ enum: WORKOUT_STATUSES, description: 'plan — done within a plan, free — outside a plan, missed' })
  status!: SummaryWorkoutView['status'];

  @ApiProperty({ description: 'Actual distance; the planned one for a missed workout' })
  distanceKm!: number;

  @ApiProperty({ type: Number, nullable: true })
  durationMin!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  avgHeartRate!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Elevation gain, metres; null when not measured' })
  elevationM!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Record distance (km) this workout holds' })
  recordDistanceKm!: number | null;
}

export class SummaryTotalsDto implements SummaryTotalsView {
  @ApiProperty()
  distanceKm!: number;

  @ApiProperty()
  durationMin!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Null when no workout carries elevation' })
  elevationM!: number | null;

  @ApiProperty()
  count!: number;
}

export class SummaryMonthDto extends SummaryTotalsDto implements SummaryMonthView {
  @ApiProperty()
  year!: number;

  @ApiProperty({ minimum: 0, maximum: 11 })
  month!: number;
}

export class SummaryYearDto extends SummaryTotalsDto implements SummaryYearView {
  @ApiProperty()
  year!: number;
}

export class SummaryComparisonDto implements SummaryComparisonView {
  @ApiProperty({ type: SummaryTotalsDto })
  totals!: SummaryTotalsDto;

  @ApiProperty()
  longestKm!: number;

  @ApiProperty({ type: Number, nullable: true })
  avgHeartRate!: number | null;

  @ApiProperty({ description: 'Seconds per km; 0 without timed workouts' })
  avgPaceSecPerKm!: number;
}

export class SummaryComparisonsDto {
  @ApiProperty({ type: SummaryComparisonDto, description: 'The same days of the previous week' })
  week!: SummaryComparisonDto;

  @ApiProperty({ type: SummaryComparisonDto, description: 'The same days of the previous month' })
  month!: SummaryComparisonDto;

  @ApiProperty({ type: SummaryComparisonDto, description: 'The previous year up to the same date' })
  year!: SummaryComparisonDto;
}

export class SummaryLongestRunDto {
  @ApiProperty()
  distanceKm!: number;

  @ApiProperty()
  date!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'Longest run before this year' })
  previousKm!: number | null;
}

export class SummaryGoalBestDto {
  @ApiProperty()
  seconds!: number;

  @ApiProperty()
  date!: string;
}

export class SummaryGoalDto implements SummaryGoalView {
  @ApiProperty()
  distanceKm!: number;

  @ApiProperty()
  targetSec!: number;

  @ApiProperty()
  raceDate!: string;

  @ApiProperty({ type: SummaryGoalBestDto, nullable: true })
  best!: SummaryGoalBestDto | null;
}

export class SummaryPlanExecutionDto implements SummaryPlanExecutionView {
  @ApiProperty()
  done!: number;

  @ApiProperty({ description: 'Plan workouts whose day has passed or that are already done' })
  due!: number;

  @ApiProperty()
  upcoming!: number;

  @ApiProperty()
  plannedKm!: number;

  @ApiProperty()
  actualKm!: number;

  @ApiProperty()
  offPlanKm!: number;
}

export class SummaryPlanExecutionScopesDto {
  @ApiProperty({ type: SummaryPlanExecutionDto })
  week!: SummaryPlanExecutionDto;

  @ApiProperty({ type: SummaryPlanExecutionDto })
  month!: SummaryPlanExecutionDto;

  @ApiProperty({ type: SummaryPlanExecutionDto })
  sinceStart!: SummaryPlanExecutionDto;
}

export class SummaryPlanDto implements SummaryPlanView {
  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  currentWeek!: number;

  @ApiProperty()
  totalWeeks!: number;

  @ApiProperty({ type: SummaryPlanExecutionScopesDto })
  execution!: SummaryPlanExecutionScopesDto;
}

export class SummaryFormPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  seconds!: number;
}

export class SummaryFormDto {
  @ApiProperty({ name: '5', type: [SummaryFormPointDto], description: '5 km races and time trials, oldest first' })
  '5'!: SummaryFormPointDto[];

  @ApiProperty({ name: '10', type: [SummaryFormPointDto], description: '10 km races and time trials, oldest first' })
  '10'!: SummaryFormPointDto[];
}

export class SummaryPacePointDto {
  @ApiProperty({ minimum: 0, maximum: 11 })
  month!: number;

  @ApiProperty()
  secPerKm!: number;
}

export class SummaryPaceDto {
  @ApiProperty({ type: [SummaryPacePointDto] })
  easy!: SummaryPacePointDto[];

  @ApiProperty({ type: [SummaryPacePointDto] })
  tempo!: SummaryPacePointDto[];

  @ApiProperty({ type: [SummaryPacePointDto] })
  interval!: SummaryPacePointDto[];
}

export class SummaryWeekKmDto {
  @ApiProperty()
  weekStart!: string;

  @ApiProperty()
  km!: number;

  @ApiProperty({ description: 'The current, unfinished week' })
  partial!: boolean;
}

export class SummaryRegularityWeekDto {
  @ApiProperty()
  weekStart!: string;

  @ApiProperty({ enum: REGULARITY_DAYS, isArray: true, description: 'Monday first' })
  days!: Array<(typeof REGULARITY_DAYS)[number]>;
}

export class SummaryPlannedTargetDto {
  @ApiProperty({ enum: ['distance', 'pace'] })
  kind!: 'distance' | 'pace';

  @ApiPropertyOptional()
  km?: number;

  @ApiPropertyOptional({ description: 'Fastest pace of the range, sec/km' })
  fromSec?: number;

  @ApiPropertyOptional({ description: 'Slowest pace of the range, sec/km' })
  toSec?: number;
}

export class SummaryActualValueDto {
  @ApiProperty({ enum: ['distance', 'pace'] })
  kind!: 'distance' | 'pace';

  @ApiPropertyOptional()
  km?: number;

  @ApiPropertyOptional({ description: 'Actual pace, sec/km' })
  sec?: number;
}

export class SummaryPlanKeyWorkoutDto {
  @ApiProperty({ enum: SUMMARY_WORKOUT_TYPES })
  type!: SummaryPlanKeyWorkoutView['type'];

  @ApiProperty()
  date!: string;

  @ApiProperty({ type: SummaryPlannedTargetDto })
  planned!: SummaryPlannedTargetDto;

  @ApiProperty({ type: SummaryActualValueDto, nullable: true, description: 'Null for a missed workout' })
  actual!: SummaryActualValueDto | null;
}

export class SummaryInsightDto {
  @ApiProperty({ enum: INSIGHT_CODES })
  code!: (typeof INSIGHT_CODES)[number];

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' }, description: 'Values for the text' })
  params!: Record<string, number>;

  @ApiProperty()
  usesHeartRate!: boolean;
}

export class SummaryAnalyticsDto {
  @ApiProperty({ description: 'False until there are enough recent workouts' })
  available!: boolean;

  @ApiProperty({ type: SummaryFormDto })
  form!: SummaryFormDto;

  @ApiProperty({ type: SummaryPaceDto, description: 'Average pace by month for each workout type group' })
  pace!: SummaryPaceDto;

  @ApiProperty({
    type: [Number],
    nullable: true,
    description: 'Share of time in Z1–Z5 this month, percent; by the average HR of each workout',
  })
  heartRateZones!: number[] | null;

  @ApiProperty({ type: Number, nullable: true })
  avgHeartRate!: number | null;

  @ApiProperty({ type: [SummaryWeekKmDto] })
  weeklyKm!: SummaryWeekKmDto[];

  @ApiProperty({ type: [SummaryRegularityWeekDto] })
  regularity!: SummaryRegularityWeekDto[];

  @ApiProperty({ type: [SummaryPlanKeyWorkoutDto] })
  planKeyWorkouts!: SummaryPlanKeyWorkoutDto[];

  @ApiProperty({ type: [SummaryInsightDto] })
  insights!: SummaryInsightDto[];
}

export class ProgressSummaryResponseDto {
  @ApiProperty({ description: 'Today in the requested timezone' })
  asOf!: string;

  @ApiProperty({ type: [SummaryWorkoutDto], description: 'From the start of this month or week, newest first' })
  workouts!: SummaryWorkoutDto[];

  @ApiProperty({ type: [SummaryMonthDto], description: 'Months of this year before the current one' })
  months!: SummaryMonthDto[];

  @ApiProperty({ type: [SummaryYearDto], description: 'Years before the current one' })
  years!: SummaryYearDto[];

  @ApiProperty({ type: String, nullable: true })
  firstWorkoutDate!: string | null;

  @ApiProperty({ type: SummaryComparisonsDto })
  comparison!: SummaryComparisonsDto;

  @ApiProperty({ type: SummaryLongestRunDto, nullable: true })
  longestRun!: SummaryLongestRunDto | null;

  @ApiProperty()
  recordsThisYear!: number;

  @ApiProperty({ type: SummaryGoalDto, nullable: true, description: 'Race goal of the active plan' })
  goal!: SummaryGoalDto | null;

  @ApiProperty({ type: SummaryPlanDto, nullable: true, description: 'The active plan' })
  plan!: SummaryPlanDto | null;

  @ApiProperty({ type: SummaryAnalyticsDto })
  analytics!: SummaryAnalyticsDto;
}
