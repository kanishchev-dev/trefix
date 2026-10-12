import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IntegrationItemResponseDto {
  @ApiProperty({ example: 'strava' })
  provider!: string;

  @ApiProperty({ example: 'connected' })
  status!: string;

  @ApiProperty({ type: String, nullable: true, example: '2026-09-24T10:00:00.000Z' })
  connectedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-09-24T10:30:00.000Z' })
  lastSyncedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '12345678' })
  externalUserId!: string | null;

  @ApiPropertyOptional({ example: 42 })
  importedActivitiesCount?: number;

  @ApiPropertyOptional({ example: true, description: 'Strava shares weight, sex and shoes (profile:read_all)' })
  profileAccess?: boolean;

  @ApiProperty({ type: String, nullable: true, example: '2026-10-09T04:00:00.000Z' })
  lastProfileSyncAt!: string | null;

  @ApiPropertyOptional({ example: true, description: 'The provider can be connected in this environment' })
  available?: boolean;

  @ApiProperty({
    type: Boolean,
    nullable: true,
    example: true,
    description: 'Device providers: profile metrics sync from Health is on',
  })
  profileSync!: boolean | null;

  @ApiPropertyOptional({ example: 0, description: 'Device providers: accepted batches not processed yet' })
  pendingBatches?: number;

  @ApiPropertyOptional({ example: ['workouts', 'heart_rate'], type: [String] })
  scopes?: string[];
}

export class StravaProfileAccessResponseDto {
  @ApiProperty({ example: 'https://www.strava.com/oauth/authorize?…' })
  authorizeUrl!: string;

  @ApiProperty({ example: '6f1d7c3a9a553b4f1e2d9c10' })
  state!: string;
}

export class IntegrationsListResponseDto {
  @ApiProperty({ type: [IntegrationItemResponseDto] })
  items!: IntegrationItemResponseDto[];
}
