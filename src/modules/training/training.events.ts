/**
 * Names of in-process domain events published by the training module.
 *
 * The values are the event bus contract: listeners in other modules subscribe
 * to them, so renaming a value is a breaking change.
 */
export const TRAINING_EVENTS = {
  PROGRESS_UPDATED: 'progress.updated',
  ATHLETE_CREATED: 'training.athlete.created',
  ATHLETE_UPDATED: 'training.athlete.updated',
  ATHLETE_ZONES_CHANGED: 'training.athlete.zones_changed',
  GEAR_REPLACE_SOON: 'training.gear.replace_soon',
  GEAR_UPDATED: 'training.gear.updated',
  GOAL_CREATED: 'training.goal.created',
  PLAN_ADAPTATION_PROPOSED: 'training.plan.adaptation_proposed',
  PLAN_ADAPTED: 'training.plan.adapted',
  PLAN_ADMIN_ACTION: 'training.plan.admin_action',
  PLAN_CANCELLED: 'training.plan.cancelled',
  PLAN_COMPLETED: 'training.plan.completed',
  PLAN_CREATED: 'training.plan.created',
  PLAN_DELETED: 'training.plan.deleted',
  PLAN_GENERATED: 'training.plan.generated',
  PLAN_METRICS_ENTERED: 'training.plan.metrics_entered',
  PLAN_STARTED: 'training.plan.started',
  PLAN_UPDATED: 'training.plan.updated',
  STATE_UPDATED: 'training.state.updated',
  WORKOUT_COMPLETED: 'training.workout.completed',
  WORKOUT_CREATED: 'training.workout.created',
  WORKOUT_UPDATED: 'training.workout.updated',
  WORKOUT_DELETED: 'training.workout.deleted',
} as const;

export type TrainingEventName = (typeof TRAINING_EVENTS)[keyof typeof TRAINING_EVENTS];
