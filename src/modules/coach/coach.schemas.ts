const COACH_EMPTY_OBJECT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const COACH_TOOL_REQUEST_SCHEMAS = [
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'getAthleteState' },
      arguments: COACH_EMPTY_OBJECT_SCHEMA,
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'getCurrentPlan' },
      arguments: COACH_EMPTY_OBJECT_SCHEMA,
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'getRecentWorkouts' },
      arguments: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
          },
        },
        additionalProperties: false,
      },
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'getGoal' },
      arguments: COACH_EMPTY_OBJECT_SCHEMA,
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'getWorkout' },
      arguments: {
        type: 'object',
        properties: {
          workoutId: {
            type: 'string',
          },
        },
        required: ['workoutId'],
        additionalProperties: false,
      },
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'analyzeWorkout' },
      arguments: {
        type: 'object',
        properties: {
          workoutId: { type: 'string' },
          actualDurationMinutes: { type: 'number' },
          actualDistanceKm: { type: 'number' },
          actualAveragePaceSecondsPerKm: { type: 'number' },
          actualAverageHeartRate: { type: 'number' },
          rpe: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['workoutId', 'actualDurationMinutes', 'actualDistanceKm'],
        additionalProperties: false,
      },
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'moveWorkout' },
      arguments: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          workoutId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['planId'],
        additionalProperties: false,
      },
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'replaceWorkout' },
      arguments: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          workoutId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['planId'],
        additionalProperties: false,
      },
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: {
      name: { type: 'string', const: 'adjustPlan' },
      arguments: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          workoutId: { type: 'string' },
          forcedAction: {
            type: 'string',
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
            ],
          },
          reason: { type: 'string' },
        },
        required: ['planId'],
        additionalProperties: false,
      },
    },
    required: ['name', 'arguments'],
    additionalProperties: false,
  },
] as const;

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
        oneOf: [...COACH_TOOL_REQUEST_SCHEMAS],
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
