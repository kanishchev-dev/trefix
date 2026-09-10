import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RealtimeCommandDto {
  @ApiProperty({ description: 'Command name sent by the frontend.' })
  @IsString()
  event!: string;

  @ApiProperty({ description: 'Optional payload for the command.', required: false })
  @IsOptional()
  data?: unknown;
}
