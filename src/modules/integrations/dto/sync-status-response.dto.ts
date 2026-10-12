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

  @ApiProperty({ type: String, nullable: true, example: '2026-09-24T10:00:00.000Z' })
  startedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-09-24T10:05:00.000Z' })
  completedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  estimatedCompletion!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Rate limit reached' })
  error!: string | null;
}
