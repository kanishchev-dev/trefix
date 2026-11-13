import { type ProgressSummary } from "@trefix/api-client";

import {
  type ProgressPlanKeyWorkout,
  type ProgressSnapshot,
} from "./progress-model";

type ApiKeyWorkout = ProgressSummary["analytics"]["planKeyWorkouts"][number];

/** The contract keeps the planned target loose; the UI needs one of two exact shapes. */
function toKeyWorkout(item: ApiKeyWorkout): ProgressPlanKeyWorkout {
  const { planned, actual } = item;
  return {
    type: item.type,
    date: item.date,
    planned:
      planned.kind === "pace"
        ? {
            kind: "pace",
            fromSec: planned.fromSec ?? 0,
            toSec: planned.toSec ?? 0,
          }
        : { kind: "distance", km: planned.km ?? 0 },
    actual: !actual
      ? null
      : actual.kind === "pace"
        ? { kind: "pace", sec: actual.sec ?? 0 }
        : { kind: "distance", km: actual.km ?? 0 },
  };
}

/** API summary → the section's domain model. */
export function toSnapshot(summary: ProgressSummary): ProgressSnapshot {
  return {
    ...summary,
    analytics: {
      ...summary.analytics,
      form: {
        "5": summary.analytics.form[5],
        "10": summary.analytics.form[10],
      },
      planKeyWorkouts: summary.analytics.planKeyWorkouts.map(toKeyWorkout),
    },
  };
}
