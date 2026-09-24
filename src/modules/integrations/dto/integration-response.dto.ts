import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IntegrationItemResponseDto {
  @ApiProperty({ example: 'strava' })
  provider!: string;

  @ApiProperty({ example: 'connected' })
  status!: string;

  @ApiPropertyOptional({ example: '2026-09-24T10:00:00.000Z' })
  connectedAt?: string | null;

  @ApiPropertyOptional({ example: '2026-09-24T10:30:00.000Z' })
  lastSyncedAt?: string | null;

  @ApiPropertyOptional({ example: '12345678' })
  externalUserId?: string | null;

  @ApiPropertyOptional({ example: 42 })
  importedActivitiesCount?: number;
}

export class IntegrationsListResponseDto {
  @ApiProperty({ type: [IntegrationItemResponseDto] })
  items!: IntegrationItemResponseDto[];
}
