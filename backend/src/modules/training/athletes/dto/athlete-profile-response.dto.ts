import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TrainingAthleteResponseDto } from '../../dto/training-response.dto';
import { PLAN_METRICS_SOURCES } from '../../training.constants';
import type { AthleteProfileView, WeeklyMileageSuggestion } from '../athlete-profile.service';
import type { HrZone } from '../hr-zones';
import type { ProfileCompleteness } from '../profile-completeness';

export class HrZoneResponseDto implements HrZone {
  @ApiProperty({ enum: [1, 2, 3, 4, 5] })
  zone!: 1 | 2 | 3 | 4 | 5;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Lower bound, bpm; null for Z1' })
  min!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Upper bound, bpm; null for Z5 without max HR' })
  max!: number | null;
}

export class WeeklyMileageSuggestionResponseDto implements WeeklyMileageSuggestion {
  @ApiProperty({ example: 34 })
  valueKm!: number;

  @ApiProperty({
    enum: PLAN_METRICS_SOURCES,
    example: 'strava',
  })
  source!: WeeklyMileageSuggestion['source'];

  @ApiProperty({ example: 28 })
  windowDays!: number;
}

export class ProfileCompletenessResponseDto implements ProfileCompleteness {
  @ApiProperty({ example: 80 })
  percent!: number;

  @ApiProperty({ type: [String], example: ['thresholdHeartRate', 'limitations'] })
  missing!: ProfileCompleteness['missing'];
}

export class AthleteProfileResponseDto extends TrainingAthleteResponseDto implements AthleteProfileView {
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Age-based estimate (208 − 0.7 × age) when max HR is not set',
  })
  maxHeartRateEstimate!: number | null;

  @ApiProperty({ type: [HrZoneResponseDto], nullable: true })
  hrZones!: HrZone[] | null;

  @ApiProperty({
    nullable: true,
    enum: ['threshold_missing', 'max_missing', 'custom_missing'],
    description: 'Why zones are not available for the chosen method',
  })
  hrZonesUnavailableReason!: string | null;

  @ApiProperty({ type: WeeklyMileageSuggestionResponseDto, nullable: true })
  weeklyMileageSuggestion!: WeeklyMileageSuggestion | null;

  @ApiProperty({ type: ProfileCompletenessResponseDto })
  completeness!: ProfileCompleteness;
}
