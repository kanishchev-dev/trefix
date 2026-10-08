import type {
  PlanDiff,
  PlanDiffAdjustment,
  PlanDiffWorkout,
} from "@workspace/api-client";

import { formatPace } from "./plan-format";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export type DiffSummaryLine = { key: string; text: string };

const round = (value: number): number => Math.round(value * 10) / 10;

/** Translates a code from a known set, falling back to the generic text for codes the client does not know yet. */
function codeText(
  t: Translate,
  prefix: string,
  code: string,
  params?: Record<string, string | number>,
): string {
  const key = `${prefix}.${code}`;
  const text = t(key, params);
  return text === key ? t(`${prefix}.generic`) : text;
}

export function adjustmentText(
  adjustment: PlanDiffAdjustment,
  t: Translate,
): string {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(adjustment.params ?? {})) {
    if (typeof value === "number") params[name] = round(value);
    else if (typeof value === "string") params[name] = value;
  }
  return codeText(t, "userPlans.diff.adjustment", adjustment.code, params);
}

export function warningText(code: string, t: Translate): string {
  return codeText(t, "userPlans.diff.warning", code);
}

export function reasonText(code: string, t: Translate): string {
  return codeText(t, "userPlans.diff.reason", code);
}

const changed = (pair: {
  before: number | null;
  after: number | null;
}): boolean => pair.after !== null && pair.before !== pair.after;

/** Headline changes of a diff: paces, safety adjustments, peak volume, long run and length. */
export function buildDiffSummary(
  diff: PlanDiff,
  t: Translate,
): DiffSummaryLine[] {
  const { summary } = diff;
  const lines: DiffSummaryLine[] = [];

  if (
    changed(summary.thresholdPace) &&
    summary.thresholdPace.before !== null &&
    summary.thresholdPace.after !== null
  ) {
    lines.push({
      key: "threshold",
      text: t("userPlans.diff.threshold", {
        before: formatPace(summary.thresholdPace.before),
        after: formatPace(summary.thresholdPace.after),
      }),
    });
  }

  summary.adjustments.forEach((adjustment, index) =>
    lines.push({
      key: `adjustment-${index}`,
      text: adjustmentText(adjustment, t),
    }),
  );

  if (changed(summary.peakWeekKm)) {
    lines.push({
      key: "peak",
      text: t("userPlans.diff.peakVolume", {
        before: round(summary.peakWeekKm.before ?? 0),
        after: round(summary.peakWeekKm.after ?? 0),
      }),
    });
  }

  if (changed(summary.longestRunKm)) {
    lines.push({
      key: "longest",
      text: t("userPlans.diff.longestRun", {
        before: round(summary.longestRunKm.before ?? 0),
        after: round(summary.longestRunKm.after ?? 0),
      }),
    });
  }

  if (changed(summary.totalWeeks)) {
    lines.push({
      key: "weeks",
      text: t("userPlans.diff.totalWeeks", {
        before: summary.totalWeeks.before ?? 0,
        after: summary.totalWeeks.after ?? 0,
      }),
    });
  }

  return lines;
}

/** Field changes of a modified workout as "field: before → after". */
export function workoutFieldChanges(
  workout: PlanDiffWorkout,
  t: Translate,
  locale: string,
): string[] {
  return Object.entries(workout.fields ?? {}).map(
    ([field, [before, after]]) => {
      const label = t(`userPlans.diff.fields.${field}`);
      return `${label === `userPlans.diff.fields.${field}` ? field : label}: ${formatValue(field, before, t, locale)} → ${formatValue(field, after, t, locale)}`;
    },
  );
}

function formatValue(
  field: string,
  value: unknown,
  t: Translate,
  locale: string,
): string {
  if (value === null || value === undefined) return "—";
  if (field === "type" && typeof value === "string")
    return t(`trainingCalendar.types.${value}`);
  if (field === "dayOfWeek" && typeof value === "number")
    return t(`userPlans.weekdays.short.${value}`);
  if (field === "scheduledAt" && typeof value === "string") {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
  }
  if (typeof value === "number") return String(round(value));
  return String(value);
}

/** True when the diff changes nothing the admin should confirm. */
export function isEmptyDiff(diff: PlanDiff): boolean {
  return diff.weeks.length === 0 && diff.summary.adjustments.length === 0;
}
