import { ApiProperty } from '@nestjs/swagger';

export class AdminCoachSessionItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Session title the coach gave it' })
  title!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastMessageAt!: Date | null;

  @ApiProperty({ description: 'Messages of the user and the coach (tool calls excluded)' })
  messagesCount!: number;
}

export class AdminCoachSessionListResponseDto {
  @ApiProperty({ type: () => AdminCoachSessionItemDto, isArray: true })
  items!: AdminCoachSessionItemDto[];
}

export class AdminCoachNoteItemDto {
  @ApiProperty({ format: 'uuid' })
  workoutId!: string;

  @ApiProperty({ example: 'ru' })
  language!: string;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: Date;
}

export class AdminCoachNoteListResponseDto {
  @ApiProperty({ type: () => AdminCoachNoteItemDto, isArray: true })
  items!: AdminCoachNoteItemDto[];
}
