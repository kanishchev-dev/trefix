import { ApiProperty } from '@nestjs/swagger';

/** Body of commands that only report success. */
export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

/** Body of commands that enqueue background work. */
export class QueuedResponseDto {
  @ApiProperty({ enum: ['queued'], example: 'queued' })
  status!: 'queued';
}
