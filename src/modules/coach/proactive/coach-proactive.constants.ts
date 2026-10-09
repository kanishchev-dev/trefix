export const COACH_PROACTIVE_QUEUE = 'coach-proactive';
export const COACH_PROACTIVE_JOB = 'coach.proactive.deliver';

export type ProactiveKind = 'gear_replace_soon' | 'adaptation_proposed' | 'adaptation_suggested';

export interface ProactiveMessage {
  userId: string;
  athleteId: string;
  kind: ProactiveKind;
  /** Rendered text (Russian, the primary audience); `params` lets clients localize. */
  content: string;
  params: Record<string, string | number | null>;
}

/** Human wording of adaptation actions in coach messages. */
export const ADAPTATION_ACTION_TEXT: Record<string, string> = {
  REDUCE_VOLUME: 'снизить объём ближайших тренировок',
  REDUCE_INTENSITY: 'снизить интенсивность ближайших тренировок',
  INCREASE_VOLUME: 'немного увеличить объём',
  INCREASE_INTENSITY: 'добавить интенсивности',
  MOVE: 'перенести тренировку',
  REPLACE: 'заменить тренировку',
  ADD_RECOVERY: 'добавить восстановление',
  REGENERATE_PLAN: 'пересобрать план',
  UPDATE_HEART_RATE: 'обновить пульсовые цели под новые зоны',
};
