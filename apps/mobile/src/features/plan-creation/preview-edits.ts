import {
  type DraftWeekOverride,
  type ManualPlanNewWorkout,
  type ManualPlanWeekOverrides,
  type ManualPlanWorkoutOverride,
} from "@workspace/api-client";

/** Client-side addition. `localId` keeps it addressable for edit/remove before saving. */
export type PlanAddition = ManualPlanNewWorkout & { weekNumber: number; localId: string };

/** User edits of a plan preview, keyed by the preview workout id. */
export type PreviewEdits = {
  overrides: Record<string, ManualPlanWorkoutOverride & { weekNumber: number }>;
  removals: Array<{ id: string; weekNumber: number; orderInWeek: number }>;
  additions: PlanAddition[];
};

export const EMPTY_PREVIEW_EDITS: PreviewEdits = { overrides: {}, removals: [], additions: [] };

export function hasPreviewEdits(edits: PreviewEdits): boolean {
  return Object.keys(edits.overrides).length > 0 || edits.removals.length > 0 || edits.additions.length > 0;
}

function newWorkoutOf(addition: PlanAddition): ManualPlanNewWorkout {
  // Local ids never reach the backend.
  return {
    type: addition.type,
    dayOfWeek: addition.dayOfWeek,
    distanceKm: addition.distanceKm,
    durationMinutes: addition.durationMinutes,
  };
}

/** Week overrides of a manual plan: workouts are addressed by preview ids (`{week}-{order}`). */
export function toManualWeekOverrides(edits: PreviewEdits): ManualPlanWeekOverrides[] | undefined {
  const weeks = new Map<number, ManualPlanWeekOverrides>();
  const weekFor = (weekNumber: number) => {
    let entry = weeks.get(weekNumber);
    if (!entry) {
      entry = { weekNumber, workoutOverrides: [], removedWorkoutIds: [], newWorkouts: [] };
      weeks.set(weekNumber, entry);
    }
    return entry;
  };

  for (const { weekNumber, ...override } of Object.values(edits.overrides)) {
    weekFor(weekNumber).workoutOverrides.push(override);
  }
  for (const removal of edits.removals) {
    weekFor(removal.weekNumber).removedWorkoutIds.push(removal.id);
  }
  for (const addition of edits.additions) {
    weekFor(addition.weekNumber).newWorkouts.push(newWorkoutOf(addition));
  }
  return weeks.size ? Array.from(weeks.values()) : undefined;
}

/** Week overrides of a stored draft or a rebuild: workouts are addressed by relative keys. */
export function toDraftWeekOverrides(edits: PreviewEdits): DraftWeekOverride[] | undefined {
  const weeks = new Map<number, Required<DraftWeekOverride>>();
  const weekFor = (weekNumber: number) => {
    let entry = weeks.get(weekNumber);
    if (!entry) {
      entry = { weekNumber, workoutOverrides: [], removedWorkoutKeys: [], newWorkouts: [] };
      weeks.set(weekNumber, entry);
    }
    return entry;
  };

  for (const { weekNumber, id, ...fields } of Object.values(edits.overrides)) {
    weekFor(weekNumber).workoutOverrides.push({ key: id, ...fields });
  }
  for (const removal of edits.removals) {
    weekFor(removal.weekNumber).removedWorkoutKeys.push(removal.id);
  }
  for (const addition of edits.additions) {
    weekFor(addition.weekNumber).newWorkouts.push(newWorkoutOf(addition));
  }
  return weeks.size ? Array.from(weeks.values()) : undefined;
}
