import { ApiProperty, ApiPropertyOptional, type ApiPropertyOptions } from '@nestjs/swagger';

import {
  HR_ZONES_METHODS,
  type HrZonesMethod,
  PROGRESS_METRICS,
  PROGRESS_PERIODS,
  type ProgressMetric,
  type ProgressPeriodKey,
  RACE_RESULT_KINDS,
  type RaceResultKind,
  RECORD_DISTANCES,
  type RecordDistance,
} from '../../training.constants';
import type {
  ProgressMetricView,
  ProgressOverviewView,
  RaceResultView,
  RecordAttemptView,
  RecordBestView,
  RecordHistoryView,
  RecordsExclusionView,
  RecordView,
} from '../progress.views';

/** OpenAPI description of the progress views; every class implements the view it documents. */

const RECORD_DISTANCE_KEYS = Object.keys(RECORD_DISTANCES) as RecordDistance[];
const EFFORT_SOURCES = ['workout', 'result'] as const;
const EFFORT_KINDS = ['race', 'workout', 'test'] as const;
const TRENDS = ['up', 'down', 'stable'] as const;
const CAPABILITY_TYPES = ['endurance', 'threshold', 'speed', 'recovery', 'consistency'] as const;
const ACCURACY_LEVELS = ['high', 'medium', 'low'] as const;
const BUCKET_SIZES = ['week', 'month'] as const;
const GOAL_STATUSES = ['achieved', 'on_track', 'behind', 'no_data', 'no_forecast'] as const;
const ACHIEVEMENT_KINDS = ['longest_run', 'streak', 'new_record', 'total_distance'] as const;

export class RecordBestDto implements RecordBestView {
  @ApiProperty()
  seconds!: number;

  @ApiProperty()
  date!: string;

  @ApiProperty({ enum: EFFORT_SOURCES })
  source!: (typeof EFFORT_SOURCES)[number];

  @ApiProperty({ enum: EFFORT_KINDS })
  kind!: (typeof EFFORT_KINDS)[number];

  @ApiProperty({ type: String, nullable: true })
  provider!: string | null;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty()
  isNew!: boolean;

  @ApiProperty({ type: String, nullable: true })
  workoutId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resultId!: string | null;
}

export class RecordDto implements RecordView {
  @ApiProperty({ enum: RECORD_DISTANCE_KEYS })
  distance!: RecordDistance;

  @ApiProperty({ type: RecordBestDto, nullable: true })
  best!: RecordBestDto | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'VDOT prediction, seconds' })
  predictionSeconds?: number | null;
}

export class ProgressRecordsResponseDto {
  @ApiProperty({ type: [RecordDto] })
  items!: RecordDto[];
}

class ProgressPeriodDto {
  @ApiProperty({ enum: PROGRESS_PERIODS })
  key!: ProgressPeriodKey;

  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;
}

class MetricsUnlockDto {
  @ApiProperty()
  required!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  unlocked!: boolean;
}

class DatedSecondsDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  seconds!: number;
}

class GoalProgressDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: String, nullable: true })
  date!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  weeksLeft!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  distanceKm!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  targetSeconds!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  forecastSeconds!: number | null;

  @ApiProperty({ enum: GOAL_STATUSES })
  status!: (typeof GOAL_STATUSES)[number];

  @ApiProperty({ type: [DatedSecondsDto] })
  series!: DatedSecondsDto[];

  @ApiProperty({ type: [DatedSecondsDto] })
  projection!: DatedSecondsDto[];

  @ApiProperty({ type: String, nullable: true })
  planName!: string | null;
}

class PredictionDto {
  @ApiProperty({ enum: RECORD_DISTANCE_KEYS })
  distance!: RecordDistance;

  @ApiProperty()
  seconds!: number;
}

class FormDto {
  @ApiProperty()
  fitness!: number;

  @ApiProperty()
  fatigue!: number;

  @ApiProperty()
  form!: number;

  @ApiProperty()
  fitnessChange!: number;

  @ApiProperty()
  changeWeeks!: number;
}

class ValueChangeDto {
  @ApiProperty()
  value!: number;

  @ApiProperty({ type: Number, nullable: true })
  change!: number | null;
}

class EstimatedValueDto {
  @ApiProperty()
  value!: number;

  @ApiProperty()
  estimated!: boolean;
}

class OverviewMetricsDto {
  @ApiProperty({ type: ValueChangeDto, nullable: true })
  thresholdPace!: ValueChangeDto | null;

  @ApiProperty({ type: ValueChangeDto, nullable: true })
  vo2max!: ValueChangeDto | null;

  @ApiProperty({ type: EstimatedValueDto, nullable: true })
  thresholdHeartRate!: EstimatedValueDto | null;
}

class CapabilityDto {
  @ApiProperty({ enum: CAPABILITY_TYPES })
  type!: (typeof CAPABILITY_TYPES)[number];

  @ApiProperty({ type: Number, nullable: true })
  value!: number | null;

  @ApiProperty({ enum: TRENDS })
  trend!: (typeof TRENDS)[number];
}

class DynamicsPointDto {
  @ApiProperty()
  start!: string;

  @ApiProperty({ type: Number, nullable: true })
  value!: number | null;
}

class DynamicsSeriesDto {
  @ApiProperty({ type: Number, nullable: true })
  average!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  changePercent!: number | null;

  @ApiProperty({ type: [DynamicsPointDto] })
  points!: DynamicsPointDto[];
}

class DynamicsMetricsDto {
  @ApiProperty({ type: DynamicsSeriesDto })
  distance!: DynamicsSeriesDto;

  @ApiProperty({ type: DynamicsSeriesDto })
  pace!: DynamicsSeriesDto;

  @ApiProperty({ type: DynamicsSeriesDto })
  heartRate!: DynamicsSeriesDto;

  @ApiProperty({ type: DynamicsSeriesDto })
  load!: DynamicsSeriesDto;
}

class ProfileVolumeHintDto {
  @ApiProperty()
  profileKm!: number;

  @ApiProperty()
  actualKm!: number;
}

class DynamicsDto {
  @ApiProperty({ enum: BUCKET_SIZES })
  bucket!: (typeof BUCKET_SIZES)[number];

  @ApiProperty({ type: DynamicsMetricsDto })
  metrics!: DynamicsMetricsDto;

  @ApiProperty({ type: ProfileVolumeHintDto, nullable: true })
  profileVolumeHint!: ProfileVolumeHintDto | null;
}

class AchievementDto {
  @ApiProperty({ enum: ACHIEVEMENT_KINDS })
  kind!: (typeof ACHIEVEMENT_KINDS)[number];

  @ApiProperty()
  value!: number;

  @ApiProperty({ type: String, nullable: true })
  date!: string | null;

  @ApiPropertyOptional({ enum: RECORD_DISTANCE_KEYS })
  distance?: RecordDistance;
}

export class ProgressOverviewResponseDto implements ProgressOverviewView {
  @ApiProperty({ type: ProgressPeriodDto })
  period!: ProgressPeriodDto;

  @ApiProperty({ type: MetricsUnlockDto })
  metricsUnlock!: MetricsUnlockDto;

  @ApiProperty({ type: GoalProgressDto, nullable: true })
  goal!: GoalProgressDto | null;

  @ApiProperty({ type: [PredictionDto] })
  predictions!: PredictionDto[];

  @ApiProperty({ description: 'Number of efforts the predictions are based on' })
  predictionBasis!: number;

  @ApiProperty({ type: FormDto, nullable: true })
  form!: FormDto | null;

  @ApiProperty({ type: OverviewMetricsDto })
  metrics!: OverviewMetricsDto;

  @ApiProperty({ type: [CapabilityDto], nullable: true })
  capabilities!: CapabilityDto[] | null;

  @ApiProperty({ type: [RecordDto] })
  records!: RecordDto[];

  @ApiProperty({ type: DynamicsDto })
  dynamics!: DynamicsDto;

  @ApiProperty({ type: [AchievementDto] })
  achievements!: AchievementDto[];
}

class AccuracyDto {
  @ApiProperty({ enum: ACCURACY_LEVELS })
  level!: (typeof ACCURACY_LEVELS)[number];

  @ApiProperty()
  efforts!: number;
}

class MetricZonesDto {
  @ApiProperty({ enum: HR_ZONES_METHODS })
  method!: HrZonesMethod;

  @ApiProperty({ type: Number, nullable: true })
  maxHeartRate!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  thresholdHeartRate!: number | null;
}

const PACE_RANGE: ApiPropertyOptions = {
  type: [Number],
  minItems: 2,
  maxItems: 2,
  description: '[from, to], seconds per km',
};

class TrainingPacesDto {
  @ApiProperty(PACE_RANGE)
  easy!: [number, number];

  @ApiProperty(PACE_RANGE)
  tempo!: [number, number];

  @ApiProperty(PACE_RANGE)
  interval!: [number, number];
}

class SeriesPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  value!: number;
}

class TopEffortDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  workoutId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resultId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true })
  workoutType!: string | null;

  @ApiProperty()
  date!: string;

  @ApiProperty()
  distanceKm!: number;

  @ApiProperty()
  paceSecondsPerKm!: number;
}

export class ProgressMetricResponseDto implements ProgressMetricView {
  @ApiProperty({ enum: PROGRESS_METRICS })
  metric!: ProgressMetric;

  @ApiProperty({ type: Number, nullable: true })
  value!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  change!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: Date | null;

  @ApiProperty({ type: [SeriesPointDto] })
  series!: SeriesPointDto[];

  @ApiProperty({ type: AccuracyDto })
  accuracy!: AccuracyDto;

  @ApiPropertyOptional({ type: MetricZonesDto })
  zones?: MetricZonesDto;

  @ApiPropertyOptional({ type: TrainingPacesDto })
  paces?: TrainingPacesDto;

  @ApiPropertyOptional({ type: [TopEffortDto] })
  topEfforts?: TopEffortDto[];
}

export class RecordAttemptDto implements RecordAttemptView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EFFORT_SOURCES })
  source!: (typeof EFFORT_SOURCES)[number];

  @ApiProperty({ enum: EFFORT_KINDS })
  kind!: (typeof EFFORT_KINDS)[number];

  @ApiProperty({ type: String, nullable: true })
  provider!: string | null;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty()
  date!: string;

  @ApiProperty()
  seconds!: number;

  @ApiProperty({ type: String, nullable: true })
  workoutId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  resultId!: string | null;
}

export class RecordHistoryResponseDto implements RecordHistoryView {
  @ApiProperty({ enum: RECORD_DISTANCE_KEYS })
  distance!: RecordDistance;

  @ApiProperty({ type: [RecordAttemptDto] })
  attempts!: RecordAttemptDto[];
}

export class RaceResultResponseDto implements RaceResultView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  distanceM!: number;

  @ApiProperty()
  timeSeconds!: number;

  @ApiProperty()
  date!: string;

  @ApiProperty({ enum: RACE_RESULT_KINDS })
  kind!: RaceResultKind;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;
}

export class RecordsExclusionResponseDto implements RecordsExclusionView {
  @ApiProperty()
  workoutId!: string;

  @ApiProperty()
  excluded!: boolean;
}
