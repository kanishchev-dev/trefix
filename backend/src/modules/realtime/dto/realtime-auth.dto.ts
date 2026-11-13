import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class RealtimeAuthDto {
  @ApiProperty({ description: 'JWT access token used to authenticate the socket connection.' })
  @IsString()
  token!: string;

  @ApiProperty({
    description: 'Rooms to join immediately after authentication.',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rooms?: string[];
}
