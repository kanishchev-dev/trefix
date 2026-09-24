import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IntegrationSyncStatusResponseDto {
  @ApiProperty({ example: 'syncing' })
  status!: string;

  @ApiProperty({ example: 42 })
  processed!: number;

  @ApiProperty({ example: 37 })
  imported!: number;

  @ApiProperty({ example: 0 })
  failed!: number;

  @ApiPropertyOptional({ example: '2026-09-24T10:00:00.000Z' })
  startedAt?: string | null;

  @ApiPropertyOptional({ example: '2026-09-24T10:05:00.000Z' })
  completedAt?: string | null;

  @ApiPropertyOptional({ example: null })
  estimatedCompletion?: string | null;

  @ApiPropertyOptional({ example: 'Rate limit reached' })
  error?: string | null;
}
