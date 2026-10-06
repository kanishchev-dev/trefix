import {
  type PlanChangePreview,
  type PlanDiff,
  type PlanDiffAdjustment,
  type PlanDiffWorkout,
} from "@workspace/api-client";

import {
  fillTemplate,
  formatPace,
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";

/** One rendered diff line plus a spoken variant ("was 12 km, now 10 km"). */
export type DiffLine = {
  text: string;
  accessibilityLabel: string;
  tone?: "added" | "removed" | "modified";
};

export type DiffWeekView = {
  weekNumber: number;
  title: string;
  lines: DiffLine[];
};

/** Describes a workout addressed by a diff key (workout id or relative key). */
export type WorkoutDescriber = (key: string) => { type?: string; dayLabel?: string } | undefined;

type DiffContext = {
  copy: MainCopy;
  language: AppLanguage;
};

const round = (value: number) => Math.round(value * 10) / 10;

function spoken(copy: MainCopy, label: string, before: string, after: string): string {
  return `${label}: ${fillTemplate(copy.plans.diff.wasNow, { before, after })}`;
}

function changedNumber(pair: { before: number | null; after: number | null }): boolean {
  return pair.before !== pair.after && pair.after !== null;
}

/** Localized adjustment; unknown codes fall back to the generic safety message. */
export function adjustmentText(adjustment: PlanDiffAdjustment, copy: MainCopy): string {
  const texts = copy.plans.diff.adjustment as Record<string, string>;
  const template = texts[adjustment.code] ?? texts.generic;
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(adjustment.params ?? {})) {
    if (typeof value === "number") params[key] = round(value);
    else if (typeof value === "string") params[key] = value;
  }
  return fillTemplate(template, params);
}

export function warningText(code: string, copy: MainCopy): string {
  const texts = copy.plans.diff.warning as Record<string, string>;
  return texts[code] ?? texts.generic;
}

export function reasonText(code: string, copy: MainCopy): string {
  const texts = copy.plans.diff.reason as Record<string, string>;
  return texts[code] ?? texts.generic;
}

/** Summary lines: volume, long run, threshold pace, plan length, adjustments. */
export function buildDiffSummary(
  diff: PlanDiff,
  { copy, language }: DiffContext,
  options: { resultingEndDate?: string | null; metricsVolume?: { before?: number | null; after?: number | null } } = {},
): DiffLine[] {
  const diffCopy = copy.plans.diff;
  const { summary } = diff;
  const lines: DiffLine[] = [];

  if (changedNumber(summary.thresholdPace) && summary.thresholdPace.before !== null && summary.thresholdPace.after !== null) {
    const before = formatPace(summary.thresholdPace.before);
    const after = formatPace(summary.thresholdPace.after);
    lines.push({
      text: `${fillTemplate(diffCopy.threshold, { before, after })} · ${diffCopy.pacesRecalculated}`,
      accessibilityLabel: spoken(copy, copy.plans.metrics.threshold, before, after),
    });
  }

  for (const adjustment of summary.adjustments) {
    if (adjustment.code === "VOLUME_SCALED" && options.metricsVolume) {
      const scale = adjustment.params?.k;
      const { before, after } = options.metricsVolume;
      if (typeof scale === "number" && before && after) {
        const text = fillTemplate(diffCopy.volumeScale, { scale: round(scale), before: round(before), after: round(after) });
        lines.push({ text, accessibilityLabel: text });
        continue;
      }
    }
    const text = adjustmentText(adjustment, copy);
    lines.push({ text, accessibilityLabel: text });
  }

  if (changedNumber(summary.peakWeekKm)) {
    const before = String(round(summary.peakWeekKm.before ?? 0));
    const after = String(round(summary.peakWeekKm.after ?? 0));
    lines.push({
      text: fillTemplate(diffCopy.peakVolume, { before, after }),
      accessibilityLabel: spoken(copy, diffCopy.peakVolume.split(":")[0], `${before} km`, `${after} km`),
    });
  }

  if (changedNumber(summary.longestRunKm)) {
    const before = String(round(summary.longestRunKm.before ?? 0));
    const after = String(round(summary.longestRunKm.after ?? 0));
    lines.push({
      text: fillTemplate(diffCopy.longestRun, { before, after }),
      accessibilityLabel: spoken(copy, diffCopy.longestRun.split(":")[0], `${before} km`, `${after} km`),
    });
  }

  if (changedNumber(summary.totalWeeks)) {
    const before = String(summary.totalWeeks.before ?? 0);
    const after = String(summary.totalWeeks.after ?? 0);
    const finish = options.resultingEndDate
      ? `, ${fillTemplate(diffCopy.finish, { date: formatShortDate(options.resultingEndDate, language) })}`
      : "";
    lines.push({
      text: `${fillTemplate(diffCopy.totalWeeks, { before, after })}${finish}`,
      accessibilityLabel: `${spoken(copy, diffCopy.totalWeeks.split(":")[0], before, after)}${finish}`,
    });
  }

  return lines;
}

function workoutLabel(workout: PlanDiffWorkout, describe: WorkoutDescriber | undefined, copy: MainCopy): string {
  const info = describe?.(workout.key);
  const typeLabels = copy.plan.creation.workoutTypes as Record<string, string>;
  const fieldType = workout.fields?.type?.[1];
  const type = info?.type ?? (typeof fieldType === "string" ? fieldType : undefined);
  const typeLabel = type ? typeLabels[type] ?? type : "";
  return [info?.dayLabel, typeLabel].filter(Boolean).join(" ") || typeLabel;
}

function formatFieldValue(field: string, value: unknown, copy: MainCopy, dayNames: readonly string[]): string {
  const units = copy.plan.creation.units;
  if (value === null || value === undefined) return "—";
  if (field === "distanceKm" && typeof value === "number") return `${round(value)} ${units.km}`;
  if (field === "durationMinutes" && typeof value === "number") return `${value} ${units.min}`;
  if (field === "dayOfWeek" && typeof value === "number") return dayNames[value] ?? String(value);
  if (field === "type" && typeof value === "string") {
    return (copy.plan.creation.workoutTypes as Record<string, string>)[value] ?? value;
  }
  if (field.startsWith("target.pace") && typeof value === "number") return formatPace(value);
  return String(value);
}

/** Week-by-week lines; only changed weeks are present in the diff. */
export function buildDiffWeeks(
  diff: PlanDiff,
  { copy }: DiffContext,
  dayNames: readonly string[],
  describe?: WorkoutDescriber,
): DiffWeekView[] {
  const diffCopy = copy.plans.diff;
  const fieldNames = diffCopy.fields as Record<string, string>;

  return diff.weeks
    .filter((week) => week.workouts.length > 0)
    .map((week) => ({
      weekNumber: week.weekNumber,
      title: fillTemplate(diffCopy.week, { number: week.weekNumber }),
      lines: week.workouts.map((workout): DiffLine => {
        const label = workoutLabel(workout, describe, copy);
        const reason = workout.reason ? ` (${reasonText(workout.reason, copy)})` : "";
        if (workout.change === "added") {
          const text = fillTemplate(diffCopy.added, { label });
          return { text, accessibilityLabel: `${diffCopy.addedBadge}: ${label}`, tone: "added" };
        }
        if (workout.change === "removed") {
          const text = `${fillTemplate(diffCopy.removed, { label })}${reason}`;
          return { text, accessibilityLabel: `${diffCopy.removedBadge}: ${label}${reason}`, tone: "removed" };
        }
        const entries = Object.entries(workout.fields ?? {}).filter(
          ([field]) => field !== "weekNumber" && !field.startsWith("target."),
        );
        const changes = entries
          .map(([field, [before, after]]) =>
            `${formatFieldValue(field, before, copy, dayNames)} → ${formatFieldValue(field, after, copy, dayNames)}`,
          )
          .join(", ");
        const spokenChanges = entries
          .map(([field, [before, after]]) =>
            spoken(
              copy,
              fieldNames[field] ?? field,
              formatFieldValue(field, before, copy, dayNames),
              formatFieldValue(field, after, copy, dayNames),
            ),
          )
          .join("; ");
        const hasPaceChange = Object.keys(workout.fields ?? {}).some((field) => field.startsWith("target."));
        const suffix = !changes && hasPaceChange ? diffCopy.pacesRecalculated : changes;
        return {
          text: `${fillTemplate(diffCopy.modified, { label, changes: suffix })}${reason}`,
          accessibilityLabel: `${label}: ${spokenChanges || suffix}${reason}`,
          tone: "modified",
        };
      }),
    }));
}

/**
 * True when the preview holds exactly what the user asked for: no warnings,
 * no rule adjustments, no plan length change and no other workout touched.
 * Such a change is applied without the diff sheet.
 */
export function isRequestedChangeOnly(
  preview: PlanChangePreview,
  request: { workoutIds: string[]; addedCount: number },
): boolean {
  const { diff, warnings } = preview;
  if (warnings.length > 0) return false;
  if (diff.summary.adjustments.length > 0) return false;
  if (diff.summary.totalWeeks.before !== diff.summary.totalWeeks.after) return false;

  const requested = new Set(request.workoutIds);
  let added = 0;
  for (const week of diff.weeks) {
    for (const workout of week.workouts) {
      if (workout.change === "added") {
        added += 1;
        continue;
      }
      if (!requested.has(workout.key)) return false;
    }
  }
  return added === request.addedCount;
}
