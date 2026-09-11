import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { CoachMessageRole, CoachToolName } from '../coach.constants';

export class CoachSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  athleteId!: string;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiProperty()
  model!: string;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiProperty({ enum: ['user', 'assistant', 'tool'] })
  role!: CoachMessageRole;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional({
    nullable: true,
    enum: [
      'getAthleteState',
      'getCurrentPlan',
      'getRecentWorkouts',
      'getGoal',
      'getWorkout',
      'analyzeWorkout',
      'moveWorkout',
      'replaceWorkout',
      'adjustPlan',
    ],
  })
  toolName!: CoachToolName | null;

  @ApiPropertyOptional({ nullable: true })
  toolCallId!: string | null;

  @ApiProperty({ type: Object })
  metadata!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CoachToolResultResponseDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ type: Object })
  input!: Record<string, unknown>;

  @ApiProperty({ type: Object })
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
