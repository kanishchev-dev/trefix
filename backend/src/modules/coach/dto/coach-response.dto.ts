import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { CoachMessageRole, CoachToolName } from '../coach.constants';
import { COACH_MESSAGE_ROLES, COACH_TOOL_NAMES } from '../coach.constants';

export class CoachSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  summary!: string | null;

  @ApiProperty()
  model!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  lastMessageAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CoachMessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ enum: COACH_MESSAGE_ROLES })
  role!: CoachMessageRole;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({
    nullable: true,
    enum: COACH_TOOL_NAMES,
  })
  toolName!: CoachToolName | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  toolCallId!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CoachToolResultResponseDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  input!: Record<string, unknown>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  output!: Record<string, unknown>;
}

export class CoachChatResponseDto {
  @ApiProperty({ type: CoachSessionResponseDto })
  session!: CoachSessionResponseDto;

  @ApiProperty({ type: CoachMessageResponseDto })
  assistantMessage!: CoachMessageResponseDto;

  @ApiProperty()
  reply!: string;

  @ApiProperty()
  coachSummary!: string;

  @ApiProperty({ type: [CoachToolResultResponseDto] })
  toolResults!: CoachToolResultResponseDto[];
}

export class CoachSessionDetailResponseDto {
  @ApiProperty({ type: CoachSessionResponseDto })
  session!: CoachSessionResponseDto;

  @ApiProperty({ type: [CoachMessageResponseDto] })
  messages!: CoachMessageResponseDto[];
}
