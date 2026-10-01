import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProgressPeriodDto {
  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty({ enum: ['4W', '8W', '3M', '6M', '1Y'] })
  periodKey!: '4W' | '8W' | '3M' | '6M' | '1Y';
}

export class ProgressFormDto {
  @ApiProperty()
  fitness!: number;

  @ApiProperty()
  fatigue!: number;

  @ApiProperty()
  form!: number;

  @ApiProperty({ enum: ['BUILDING', 'MAINTAINING', 'RECOVERING', 'PEAK', 'TAPERING'] })
  status!: 'BUILDING' | 'MAINTAINING' | 'RECOVERING' | 'PEAK' | 'TAPERING';

  @ApiProperty({ enum: ['IMPROVING', 'STABLE', 'DECLINING'] })
  trend!: 'IMPROVING' | 'STABLE' | 'DECLINING';

  @ApiProperty()
  change!: number;

  @ApiPropertyOptional()
  periodComparison?: string;
}

export class ProgressGoalDto {
  @ApiProperty({ enum: ['RACE_TIME', 'DISTANCE', 'PACE', 'CONSISTENCY', 'CUSTOM'] })
  type!: 'RACE_TIME' | 'DISTANCE' | 'PACE' | 'CONSISTENCY' | 'CUSTOM';

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  distance?: string;

  @ApiProperty()
  target!: string;

  @ApiProperty()
  currentEstimate!: string;

  @ApiProperty()
  delta!: string;

  @ApiPropertyOptional()
  progress?: number;

  @ApiProperty({ enum: ['ON_TRACK', 'IMPROVING', 'BEHIND', 'ACHIEVED', 'NO_LONGER_ACTIVE'] })
  status!: 'ON_TRACK' | 'IMPROVING' | 'BEHIND' | 'ACHIEVED' | 'NO_LONGER_ACTIVE';

  @ApiPropertyOptional()
  targetDate?: string | null;
}

export class ProgressCapabilityDto {
  @ApiProperty({ enum: ['ENDURANCE', 'SPEED', 'THRESHOLD', 'RECOVERY', 'CONSISTENCY'] })
  type!: 'ENDURANCE' | 'SPEED' | 'THRESHOLD' | 'RECOVERY' | 'CONSISTENCY';

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty()
  value!: number;

  @ApiProperty()
  change!: number;

  @ApiProperty({ enum: ['UP', 'STABLE', 'DOWN'] })
  trend!: 'UP' | 'STABLE' | 'DOWN';

  @ApiPropertyOptional()
  period?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  currentMetric?: string;

  @ApiPropertyOptional()
  previousMetric?: string;

  @ApiPropertyOptional({ type: [String] })
  trainingFactors?: string[];
}

export class ProgressPerformancePointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  value!: number;

  @ApiPropertyOptional()
  label?: string;
}

export class ProgressPerformanceMetricDto {
  @ApiProperty({ enum: ['distance', 'pace', 'heartRate', 'trainingLoad', 'elevation'] })
  metric!: 'distance' | 'pace' | 'heartRate' | 'trainingLoad' | 'elevation';

  @ApiProperty()
  title!: string;

  @ApiProperty()
  currentValue!: string;

  @ApiPropertyOptional()
  previousValue?: string;

  @ApiPropertyOptional()
  comparableContext?: string;

  @ApiPropertyOptional()
  changePercent?: number;

  @ApiProperty()
  unit!: string;

  @ApiProperty({ type: [ProgressPerformancePointDto] })
  dataPoints!: ProgressPerformancePointDto[];
}

export class ProgressMilestoneDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  date!: string;

  @ApiPropertyOptional()
  previousBest?: string;

  @ApiPropertyOptional()
  change?: string;

  @ApiPropertyOptional()
  context?: string;

  @ApiPropertyOptional()
  workoutId?: string;

  @ApiPropertyOptional()
  category?: string;
}

export class ProgressTrainingImpactFactorDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  percentage!: number;

  @ApiPropertyOptional()
  description?: string;
}

export class ProgressTrainingImpactDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [ProgressTrainingImpactFactorDto] })
  factors!: ProgressTrainingImpactFactorDto[];
}

export class ProgressSnapshotResponseDto {
  @ApiProperty({ type: ProgressPeriodDto })
  period!: ProgressPeriodDto;

  @ApiProperty({ type: ProgressFormDto })
  form!: ProgressFormDto;

  @ApiPropertyOptional({ type: ProgressGoalDto, nullable: true })
  goal?: ProgressGoalDto | null;

  @ApiProperty({ type: [ProgressCapabilityDto] })
  capabilities!: ProgressCapabilityDto[];

  @ApiProperty({ type: [ProgressPerformanceMetricDto] })
  performance!: ProgressPerformanceMetricDto[];

  @ApiProperty({ type: [ProgressMilestoneDto] })
  milestones!: ProgressMilestoneDto[];

  @ApiPropertyOptional({ type: ProgressTrainingImpactDto, nullable: true })
  trainingImpact?: ProgressTrainingImpactDto | null;
}
