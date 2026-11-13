import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AnalyzeWorkoutDto {
  @ApiProperty()
  @IsUUID()
  workoutId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualDurationMinutes!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualDistanceKm!: number;

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualAveragePaceSecondsPerKm?: number;

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualAverageHeartRate?: number;

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  rpe?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
