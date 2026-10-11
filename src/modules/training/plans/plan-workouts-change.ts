import type {
  ChangeContext,
  ComputedPlanChange,
  PlanMutation,
  WorkoutCreation,
  WorkoutOperation,
  WorkoutPatch,
} from './plan-change.types';
import { PlanChangeSupport } from './plan-change-support';
import { mondayIndex } from './plan-utils';

/** Workout operations (add, update, move, remove) on the active plan. */
export class WorkoutsChange extends PlanChangeSupport {
  compute(context: ChangeContext, operations: WorkoutOperation[]): ComputedPlanChange {
    if (operations.length === 0) {
      throw this.invalid('At least one operation is required');
    }

    const before = this.project(context);
    const after = this.clone(before);
    const mutation: PlanMutation = { removals: [], updates: [], creations: [] };
    const patches = new Map<string, WorkoutPatch>();
    const created = new Map<string, WorkoutCreation>();
    const touchedWeeks = new Set<number>();

    operations.forEach((operation, index) => {
      if (operation.op === 'add') {
        const date = this.dateInPlan(context, operation.date);
        const weekNumber = this.weekNumberOfDate(context, date);
        const week = this.findWeek(after, weekNumber);
        const type = this.validated({
          type: operation.type ?? 'easy',
          distanceKm: operation.distanceKm,
          durationMinutes: operation.durationMinutes ?? 30,
        });
        const durationMinutes = operation.durationMinutes ?? 30;
        const rebuilt = this.engine.rebuildWorkoutTarget({
          type,
          durationMinutes,
          thresholdPaceSecondsPerKm: context.threshold ?? this.weekThreshold(week),
        });
        const key = `new-${index + 1}`;
        touchedWeeks.add(weekNumber);
        week.workouts.push({
          key,
          dayOfWeek: mondayIndex(new Date(`${date}T00:00:00Z`)),
          orderInWeek: week.workouts.length + 1,
          type,
          phase: week.phase,
          durationMinutes,
          distanceKm: operation.distanceKm ?? 0,
          target: rebuilt.target,
          steps: rebuilt.steps,
        });
        created.set(key, {
          weekNumber,
          scheduledAt: new Date(`${date}T00:00:00Z`),
          orderInWeek: 0,
          type,
          phase: week.phase,
          durationMinutes,
          distanceKm: operation.distanceKm ?? 0,
          target: rebuilt.target,
          steps: rebuilt.steps,
        });
        return;
      }

      const row = operation.workoutId ? context.rows.get(operation.workoutId) : undefined;
      if (!row) {
        throw this.invalid('Workout not found in this plan');
      }
      this.ensureEditable(row, context.today);
      const location = this.locate(after, row.id);
      if (!location) {
        throw this.invalid('Workout not found in this plan');
      }
      const patch = patches.get(row.id) ?? {};
      touchedWeeks.add(location.week.weekNumber);

      if (operation.op === 'remove') {
        location.week.workouts = location.week.workouts.filter((workout) => workout.key !== row.id);
        mutation.removals.push(row.id);
        patches.delete(row.id);
        return;
      }

      if (operation.op === 'move') {
        const date = this.dateInPlan(context, operation.date);
        const weekNumber = this.weekNumberOfDate(context, date);
        const target = this.findWeek(after, weekNumber);
        touchedWeeks.add(weekNumber);
        location.week.workouts = location.week.workouts.filter((workout) => workout.key !== row.id);
        location.workout.dayOfWeek = mondayIndex(new Date(`${date}T00:00:00Z`));
        target.workouts.push(location.workout);
        patch.scheduledAt = new Date(`${date}T00:00:00Z`);
        patch.weekNumber = weekNumber;
      }

      if (operation.op === 'update') {
        const workout = location.workout;
        const type = this.validated({
          type: operation.type ?? workout.type,
          distanceKm: operation.distanceKm,
          durationMinutes: operation.durationMinutes ?? workout.durationMinutes,
        });
        const previousType = workout.type;
        workout.type = type;
        workout.durationMinutes = operation.durationMinutes ?? workout.durationMinutes;
        workout.distanceKm = operation.distanceKm ?? workout.distanceKm;
        const rebuilt = this.engine.rebuildWorkoutTarget({
          type,
          durationMinutes: workout.durationMinutes,
          previousType,
          previousTarget: workout.target,
          thresholdPaceSecondsPerKm: context.threshold,
        });
        workout.target = rebuilt.target;
        workout.steps = rebuilt.steps;
        Object.assign(patch, {
          type,
          durationMinutes: workout.durationMinutes,
          distanceKm: workout.distanceKm,
          target: rebuilt.target,
          steps: rebuilt.steps,
        });
      }

      patches.set(row.id, patch);
    });

    this.reorder(after, context, patches, created, touchedWeeks);
    mutation.updates = [...patches.entries()]
      .filter(([, patch]) => Object.keys(patch).length > 0)
      .map(([id, patch]) => ({ id, patch }));
    mutation.creations = [...created.values()];

    return {
      diff: this.engine.diffPlans(before, after),
      warnings: [],
      resultingEndDate: context.planEnd,
      mutation,
    };
  }
}
