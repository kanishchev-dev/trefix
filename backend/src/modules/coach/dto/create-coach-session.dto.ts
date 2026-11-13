import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCoachSessionDto {
  @ApiProperty()
  @IsUUID()
  athleteId!: string;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  title?: string;
}
