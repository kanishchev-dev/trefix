import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class RealtimeSubscriptionDto {
  @ApiProperty({
    description: 'List of room names to join or leave.',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  rooms!: string[];
}
