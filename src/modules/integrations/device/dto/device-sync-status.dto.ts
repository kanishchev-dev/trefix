import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IntegrationSyncStatusResponseDto } from '../../dto/sync-status-response.dto';

export class DeviceSyncCountersDto {
  @ApiProperty() created!: number;
  @ApiProperty() updated!: number;
  @ApiProperty() merged!: number;
  @ApiProperty() matchedPlanned!: number;
  @ApiProperty() matchedManual!: number;
  @ApiProperty() skipped!: number;
  @ApiProperty() rejected!: number;
  @ApiProperty() deleted!: number;
  @ApiProperty() failed!: number;
}

export class DeviceSyncStatusResponseDto extends IntegrationSyncStatusResponseDto {
  @ApiPropertyOptional({ nullable: true })
  lastSyncId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'foreground' })
  lastSyncType!: string | null;

  @ApiProperty({ example: 0, description: 'Accepted batches not processed yet' })
  pendingBatches!: number;

  @ApiProperty({ type: DeviceSyncCountersDto, description: 'Outcomes of the latest sync session' })
  counters!: DeviceSyncCountersDto;
}

export class WorkoutSourceItemDto {
  @ApiProperty({ example: 'apple_health' })
  provider!: string;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'Apple Watch' })
  originDevice!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'com.apple.health' })
  originAppId!: string | null;

  @ApiProperty({ example: '2026-10-08T04:12:03.000Z' })
  startedAt!: Date;
}

export class WorkoutSourcesResponseDto {
  @ApiProperty({ type: [WorkoutSourceItemDto], description: 'Primary first' })
  items!: WorkoutSourceItemDto[];
}
