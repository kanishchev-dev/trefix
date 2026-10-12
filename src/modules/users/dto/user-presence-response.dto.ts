import { ApiProperty } from '@nestjs/swagger';

export class UserPresenceResponseDto {
  @ApiProperty({
    type: [String],
    description: 'Subset of the requested user ids that currently hold a realtime connection',
    example: ['0f2b1c34-1a2b-4c3d-8e5f-6a7b8c9d0e1f'],
  })
  onlineUserIds!: string[];
}
