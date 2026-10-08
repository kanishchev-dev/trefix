"use client";

import type { ReactElement } from "react";

import { Alert, AlertDescription } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { TriangleAlertIcon } from "lucide-react";

import type { PlanDiff } from "@workspace/api-client";

import { useI18n } from "@/shared/i18n";

import {
  buildDiffSummary,
  isEmptyDiff,
  reasonText,
  warningText,
  workoutFieldChanges,
} from "../lib/plan-diff";

const CHANGE_VARIANTS = {
  added: "default",
  removed: "destructive",
  modified: "secondary",
} as const;

/**
 * What a change does to the plan: headline numbers, safety adjustments,
 * warnings and the per-week workout changes. Workouts are labelled through
 * `describe`, since the diff only carries their keys.
 */
export function PlanDiffView({
  diff,
  warnings = [],
  describe,
}: {
  diff: PlanDiff;
  warnings?: readonly string[];
  describe?: (key: string) => string | undefined;
}): ReactElement {
  const { t, locale } = useI18n();
  const summary = buildDiffSummary(diff, t);

  if (isEmptyDiff(diff) && warnings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("userPlans.diff.noChanges")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {warnings.map((code) => (
        <Alert key={code}>
          <TriangleAlertIcon />
          <AlertDescription>{warningText(code, t)}</AlertDescription>
        </Alert>
      ))}

      {summary.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {summary.map((line) => (
            <li key={line.key}>{line.text}</li>
          ))}
        </ul>
      ) : null}

      {diff.weeks.length > 0 ? (
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
          {diff.weeks.map((week) => (
            <div key={week.weekNumber} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t("userPlans.weeks.week", { number: week.weekNumber })}
              </span>
              <ul className="flex flex-col gap-1">
                {week.workouts.map((workout) => {
                  const label =
                    describe?.(workout.key) ?? t("userPlans.diff.workout");
                  const changes =
                    workout.change === "modified"
                      ? workoutFieldChanges(workout, t, locale)
                      : [];

                  return (
                    <li
                      key={`${workout.key}-${workout.change}`}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <Badge variant={CHANGE_VARIANTS[workout.change]}>
                        {t(`userPlans.diff.change.${workout.change}`)}
                      </Badge>
                      <span>{label}</span>
                      {changes.length > 0 ? (
                        <span className="text-muted-foreground">
                          {changes.join(", ")}
                        </span>
                      ) : null}
                      {workout.reason ? (
                        <span className="text-muted-foreground">
                          ({reasonText(workout.reason, t)})
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
