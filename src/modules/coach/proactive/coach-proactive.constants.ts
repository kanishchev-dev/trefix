import type { CoachProactiveTopic } from '@/modules/users/users.constants';

export const COACH_PROACTIVE_QUEUE = 'coach-proactive';
export const COACH_PROACTIVE_JOB = 'coach.proactive.deliver';

export type ProactiveKind = 'gear_replace_soon' | 'adaptation_proposed' | 'adaptation_suggested';

/** Settings topic that gates each kind; `null` — system messages that only follow quiet hours. */
export const PROACTIVE_KIND_TOPIC: Record<ProactiveKind, CoachProactiveTopic | null> = {
  gear_replace_soon: null,
  adaptation_proposed: null,
  adaptation_suggested: null,
};

export interface ProactiveMessage {
  userId: string;
  athleteId: string;
  kind: ProactiveKind;
  /** Text rendered in the user's language (see `CoachMessageTexts`); `params` lets clients re-render it. */
  content: string;
  params: Record<string, string | number | null>;
}
