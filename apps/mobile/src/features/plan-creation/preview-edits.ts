import {
  type DraftWeekOverride,
  type ManualPlanPreview,
  type ManualPlanPreviewWorkout,
  type ManualPlanNewWorkout,
  type ManualPlanWeekOverrides,
  type ManualPlanWorkoutOverride,
  previewWorkoutPhase,
} from "@trefix/api-client";

/** Client-side addition. `localId` keeps it addressable for edit/remove before saving. */
export type PlanAddition = ManualPlanNewWorkout & {
  weekNumber: number;
  localId: string;
};

/** User edits of a plan preview, keyed by the preview workout id. */
export type PreviewEdits = {
  overrides: Record<string, ManualPlanWorkoutOverride & { weekNumber: number }>;
  removals: Array<{ id: string; weekNumber: number; orderInWeek: number }>;
  additions: PlanAddition[];
};

export const EMPTY_PREVIEW_EDITS: PreviewEdits = {
  overrides: {},
  removals: [],
  additions: [],
};

export function hasPreviewEdits(edits: PreviewEdits): boolean {
  return (
    Object.keys(edits.overrides).length > 0 ||
    edits.removals.length > 0 ||
    edits.additions.length > 0
  );
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
export function toManualWeekOverrides(
  edits: PreviewEdits,
): ManualPlanWeekOverrides[] | undefined {
  const weeks = new Map<number, ManualPlanWeekOverrides>();
  const weekFor = (weekNumber: number) => {
    let entry = weeks.get(weekNumber);
    if (!entry) {
      entry = {
        weekNumber,
        workoutOverrides: [],
        removedWorkoutIds: [],
        newWorkouts: [],
      };
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
export function toDraftWeekOverrides(
  edits: PreviewEdits,
): DraftWeekOverride[] | undefined {
  const weeks = new Map<number, Required<DraftWeekOverride>>();
  const weekFor = (weekNumber: number) => {
    let entry = weeks.get(weekNumber);
    if (!entry) {
      entry = {
        weekNumber,
        workoutOverrides: [],
        removedWorkoutKeys: [],
        newWorkouts: [],
      };
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

// ---- local editing of a preview ----

/** Ids of client-side additions, so they can be told apart from preview workouts. */
export const NEW_WORKOUT_ID_PREFIX = "new:";

export const isAdditionId = (id: string): boolean =>
  id.startsWith(NEW_WORKOUT_ID_PREFIX);

type WorkoutFieldChanges = Partial<
  Pick<PlanAddition, "type" | "dayOfWeek" | "distanceKm" | "durationMinutes">
>;

/** Applies an edit to an added workout (by its local id) or records an override of a preview one. */
export function withWorkoutChanges(
  edits: PreviewEdits,
  workoutId: string,
  weekNumber: number,
  changes: WorkoutFieldChanges,
): PreviewEdits {
  if (isAdditionId(workoutId)) {
    const localId = workoutId.slice(NEW_WORKOUT_ID_PREFIX.length);
    return {
      ...edits,
      additions: edits.additions.map((addition) =>
        addition.localId === localId
          ? {
              ...addition,
              type: changes.type ?? addition.type,
              dayOfWeek: changes.dayOfWeek ?? addition.dayOfWeek,
              distanceKm: changes.distanceKm ?? addition.distanceKm,
              durationMinutes:
                changes.durationMinutes ?? addition.durationMinutes,
            }
          : addition,
      ),
    };
  }
  return {
    ...edits,
    overrides: {
      ...edits.overrides,
      [workoutId]: {
        ...edits.overrides[workoutId],
        id: workoutId,
        weekNumber,
        ...changes,
      },
    },
  };
}

/** Drops an added workout, or marks a preview workout as removed (and forgets its overrides). */
export function withWorkoutRemoved(
  edits: PreviewEdits,
  workout: { id: string; weekNumber: number; orderInWeek: number },
): PreviewEdits {
  if (isAdditionId(workout.id)) {
    const localId = workout.id.slice(NEW_WORKOUT_ID_PREFIX.length);
    return {
      ...edits,
      additions: edits.additions.filter(
        (addition) => addition.localId !== localId,
      ),
    };
  }
  const overrides = { ...edits.overrides };
  delete overrides[workout.id];
  return {
    ...edits,
    overrides,
    removals: edits.removals.some((item) => item.id === workout.id)
      ? edits.removals
      : [
          ...edits.removals,
          {
            id: workout.id,
            weekNumber: workout.weekNumber,
            orderInWeek: workout.orderInWeek,
          },
        ],
  };
}

/** The preview as the user sees it: overrides applied, removals dropped, additions placed in their weeks. */
export function resolvePreview(
  preview: ManualPlanPreview,
  edits: PreviewEdits,
) {
  const resolvedWorkouts = new Map<string, ManualPlanPreviewWorkout>();
  for (const week of preview.weeks) {
    for (const workout of week.workouts) {
      if (edits.removals.some((item) => item.id === workout.id)) {
        continue;
      }
      const override = edits.overrides[workout.id];
      resolvedWorkouts.set(
        workout.id,
        override
          ? { ...workout, ...override, weekNumber: workout.weekNumber }
          : workout,
      );
    }
  }

  const additionsByWeek = new Map<number, ManualPlanPreviewWorkout[]>();
  edits.additions.forEach((addition, index) => {
    const list = additionsByWeek.get(addition.weekNumber) ?? [];
    const week = preview.weeks.find(
      (item) => item.weekNumber === addition.weekNumber,
    );
    list.push({
      id: `${NEW_WORKOUT_ID_PREFIX}${addition.localId}`,
      type: addition.type,
      phase: previewWorkoutPhase(week?.phase ?? "base"),
      weekNumber: addition.weekNumber,
      dayOfWeek: addition.dayOfWeek,
      scheduledAt: "",
      orderInWeek: 1000 + index,
      durationMinutes: addition.durationMinutes,
      distanceKm: addition.distanceKm ?? 0,
      target: {},
      steps: [],
    });
    additionsByWeek.set(addition.weekNumber, list);
  });

  const totalDistance =
    Array.from(resolvedWorkouts.values()).reduce(
      (sum, workout) => sum + workout.distanceKm,
      0,
    ) +
    Array.from(additionsByWeek.values())
      .flat()
      .reduce((sum, workout) => sum + workout.distanceKm, 0);

  return { resolvedWorkouts, additionsByWeek, totalDistance };
}
