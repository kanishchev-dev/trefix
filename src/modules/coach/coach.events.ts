/**
 * Names of in-process domain events published by the coach module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const COACH_EVENTS = {
  REPLY_GENERATED: 'coach.reply.generated',
  SESSION_CREATED: 'coach.session.created',
} as const;

export type CoachEventName = (typeof COACH_EVENTS)[keyof typeof COACH_EVENTS];
