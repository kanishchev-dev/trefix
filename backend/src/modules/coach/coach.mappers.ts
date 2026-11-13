import { COACH_DEFAULT_TITLE } from './coach.constants';
import { CoachMessageResponseDto, CoachSessionResponseDto } from './dto/coach-response.dto';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';

export function toCoachSessionView(session: CoachSession): CoachSessionResponseDto {
  return {
    id: session.id,
    userId: session.userId,
    athleteId: session.athleteId,
    title: session.title,
    summary: session.summary,
    model: session.model,
    lastMessageAt: session.lastMessageAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function toCoachMessageView(message: CoachMessage): CoachMessageResponseDto {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    toolName: message.toolName,
    toolCallId: message.toolCallId,
    metadata: message.metadata,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

/** Session title derived from the first exchange. */
export function deriveCoachTitle(userMessage: string, reply: string): string {
  const candidate = `${userMessage} ${reply}`.trim().slice(0, 80);
  return candidate || COACH_DEFAULT_TITLE;
}
