import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { DATA_EXPORT_STATUSES, type DataExportStatus } from './data-export.constants';

export class DataExportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: DATA_EXPORT_STATUSES, description: '`ready` — the link was emailed' })
  status!: DataExportStatus;

  @ApiProperty()
  requestedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readyAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the emailed link stops working',
  })
  expiresAt!: Date | null;

  @ApiProperty({ description: 'When a new export can be requested' })
  nextAvailableAt!: Date;
}

export class DataExportStatusResponseDto {
  @ApiProperty({ type: DataExportResponseDto, nullable: true })
  latest!: DataExportResponseDto | null;
}

export class DataExportDownloadQueryDto {
  @ApiProperty({ description: 'Token from the emailed link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
