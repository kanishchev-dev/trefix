import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleNativeExchangeDto {
  @ApiProperty({ example: 'authorization-code' })
  @IsString()
  @IsNotEmpty()
  authorizationCode!: string;

  /**
   * Apple puts the name only into the device credential, and only on the first
   * authorization; its identity token never carries it.
   */
  @ApiPropertyOptional({ example: 'Viktor' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Kanishchev' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
