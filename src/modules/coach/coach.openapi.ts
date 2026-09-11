export const COACH_SESSION_EXAMPLE = {
  id: 'coach-session-1',
  userId: 'user-1',
  athleteId: 'athlete-1',
  title: 'Training Coach',
  summary: 'Focus on steady aerobic progression and race-specific work.',
  model: 'gpt-5',
  lastMessageAt: '2026-09-11T08:00:00.000Z',
  createdAt: '2026-09-11T07:00:00.000Z',
  updatedAt: '2026-09-11T08:00:00.000Z',
};

export const COACH_MESSAGE_EXAMPLE = {
  id: 'coach-message-1',
  sessionId: 'coach-session-1',
  role: 'assistant',
  content: 'I would keep the next session easy and monitor recovery.',
  toolName: null,
  toolCallId: null,
  metadata: {
    summary: 'Kept training conservative after recent fatigue.',
    safetyFlags: [],
  },
  createdAt: '2026-09-11T08:00:00.000Z',
  updatedAt: '2026-09-11T08:00:00.000Z',
};

export const COACH_SESSION_DETAIL_EXAMPLE = {
  session: COACH_SESSION_EXAMPLE,
  messages: [
    {
      id: 'coach-message-0',
      sessionId: 'coach-session-1',
      role: 'user',
      content: 'What should I do this week?',
      toolName: null,
      toolCallId: null,
      metadata: {},
      createdAt: '2026-09-11T07:30:00.000Z',
      updatedAt: '2026-09-11T07:30:00.000Z',
    },
    COACH_MESSAGE_EXAMPLE,
  ],
};

export const COACH_CHAT_RESPONSE_EXAMPLE = {
  session: COACH_SESSION_EXAMPLE,
  assistantMessage: COACH_MESSAGE_EXAMPLE,
  reply: 'I would keep the next session easy and monitor recovery.',
  coachSummary: 'Kept training conservative after recent fatigue.',
  toolResults: [],
};
