export const COACH_DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    stage: {
      type: 'string',
      enum: ['need_tools', 'final', 'need_clarification'],
    },
    reply: {
      type: 'string',
    },
    summary: {
      type: 'string',
    },
    toolRequests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
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
          },
          arguments: {
            type: 'object',
            properties: {
              limit: { type: ['integer', 'null'] },
              workoutId: { type: ['string', 'null'] },
              planId: { type: ['string', 'null'] },
              actualDurationMinutes: { type: ['number', 'null'] },
              actualDistanceKm: { type: ['number', 'null'] },
              actualAveragePaceSecondsPerKm: { type: ['number', 'null'] },
              actualAverageHeartRate: { type: ['number', 'null'] },
              rpe: { type: ['number', 'null'] },
              notes: { type: ['string', 'null'] },
              reason: { type: ['string', 'null'] },
              forcedAction: {
                type: ['string', 'null'],
                enum: [
                  'KEEP',
                  'MOVE',
                  'REDUCE_VOLUME',
                  'REDUCE_INTENSITY',
                  'INCREASE_VOLUME',
                  'INCREASE_INTENSITY',
                  'REPLACE',
                  'ADD_RECOVERY',
                  'REGENERATE_PLAN',
                  null,
                ],
              },
            },
            required: [
              'limit',
              'workoutId',
              'planId',
              'actualDurationMinutes',
              'actualDistanceKm',
              'actualAveragePaceSecondsPerKm',
              'actualAverageHeartRate',
              'rpe',
              'notes',
              'reason',
              'forcedAction',
            ],
            additionalProperties: false,
          },
        },
        required: ['name', 'arguments'],
        additionalProperties: false,
      },
    },
    clarifyingQuestion: {
      type: ['string', 'null'],
    },
    safetyFlags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['stage', 'reply', 'summary', 'toolRequests', 'clarifyingQuestion', 'safetyFlags'],
  additionalProperties: false,
} as const;

export const COACH_FINAL_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
    },
    summary: {
      type: 'string',
    },
    safetyFlags: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['reply', 'summary', 'safetyFlags'],
  additionalProperties: false,
} as const;
