import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class RegeneratePlanDto {
  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsDateString()
  @IsOptional()
  startDate?: string;
}
