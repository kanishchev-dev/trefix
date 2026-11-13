import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

import { CONSENT_CLIENT_PLATFORMS, CONSENT_TYPES, type ConsentType } from '../consents.constants';

export class ConsentClientDto {
  @ApiPropertyOptional({ enum: CONSENT_CLIENT_PLATFORMS })
  @IsOptional()
  @IsIn(CONSENT_CLIENT_PLATFORMS)
  platform?: (typeof CONSENT_CLIENT_PLATFORMS)[number];

  @ApiPropertyOptional({ example: '1.4.0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @ApiPropertyOptional({ example: 'ru' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}

export class GiveConsentDto {
  @ApiProperty({ enum: CONSENT_TYPES, example: 'health_data' })
  @IsIn(CONSENT_TYPES)
  type!: ConsentType;

  @ApiProperty({ example: '2026-10', description: 'Version of the consent text the user accepted' })
  @IsString()
  @Matches(/^[0-9A-Za-z.-]{1,20}$/)
  version!: string;

  @ApiPropertyOptional({ type: ConsentClientDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConsentClientDto)
  client?: ConsentClientDto;
}

export class RevokeConsentParamsDto {
  @ApiProperty({ enum: CONSENT_TYPES })
  @IsIn(CONSENT_TYPES)
  type!: ConsentType;
}

export class ConsentResponseDto {
  @ApiProperty({ enum: CONSENT_TYPES })
  type!: ConsentType;

  @ApiProperty({ example: '2026-10' })
  version!: string;

  @ApiProperty({ example: '2026-10-09T10:00:00.000Z' })
  acceptedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  revokedAt!: Date | null;

  @ApiProperty({ description: 'Active and matches the current text version' })
  isCurrent!: boolean;
}

export class ConsentVersionsDto implements Record<ConsentType, string> {
  @ApiProperty({ example: '2026-10' })
  health_data!: string;
}

export class ConsentsListResponseDto {
  @ApiProperty({ type: [ConsentResponseDto], description: 'Latest record of every consent type' })
  items!: ConsentResponseDto[];

  @ApiProperty({ type: ConsentVersionsDto, description: 'Current text version per consent type' })
  currentVersions!: Record<ConsentType, string>;
}
