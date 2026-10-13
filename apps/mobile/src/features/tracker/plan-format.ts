import type { ExecutionStep } from "@trefix/api-client";

import type { MainCopy } from "../../locales";
import { fillTemplate } from "../../locales";
import type { UnitSystem } from "../../shared/lib/units";
import { formatClock, formatPaceValue } from "./format";

type TrackerCopy = MainCopy["tracker"];

/** "10 мин", "1:30", "400 м", "2 км". */
export function formatStepSize(
  step: Pick<ExecutionStep, "durationSec" | "distanceM">,
  t: TrackerCopy,
): string | null {
  if (step.durationSec !== null && step.durationSec !== undefined) {
    return step.durationSec % 60 === 0
      ? `${step.durationSec / 60} ${t.units.min}`
      : formatClock(step.durationSec * 1000);
  }
  if (step.distanceM !== null && step.distanceM !== undefined) {
    return step.distanceM >= 1000 && step.distanceM % 100 === 0
      ? `${String(step.distanceM / 1000).replace(".", t.units.decimal)} ${t.units.km}`
      : `${Math.round(step.distanceM)} ${t.units.m}`;
  }
  return null;
}

/** "4:00–4:10 /км" */
export function formatTargetPace(
  step: ExecutionStep,
  units: UnitSystem,
  paceUnit: string,
): string | null {
  if (!step.targetPace) return null;
  return `${formatPaceValue(step.targetPace.minSecPerKm, units)}–${formatPaceValue(step.targetPace.maxSecPerKm, units)} ${paceUnit}`;
}

export type PlanRow = {
  key: string;
  label: string;
  detail: string;
  pace: string | null;
  /** The execution steps folded into this row. */
  steps: ExecutionStep[];
};

/**
 * Rows for the plan preview: repeats fold into "6 × 400 м / 1:30", the other
 * steps stay one per row.
 */
export function planRows(
  steps: ExecutionStep[],
  t: TrackerCopy,
  units: UnitSystem,
  paceUnit: string,
): PlanRow[] {
  const rows: PlanRow[] = [];
  let i = 0;
  while (i < steps.length) {
    const step = steps[i]!;
    if (step.repetition && step.kind === "work") {
      const isRep = (item: ExecutionStep | undefined): boolean =>
        item?.kind === "work" && item.repetition !== null;
      let j = i;
      // The repeats and the recoveries between them.
      while (
        isRep(steps[j]) ||
        (steps[j]?.kind === "recovery" && isRep(steps[j + 1]))
      )
        j += 1;
      const recovery = steps
        .slice(i, j)
        .find((item) => item.kind === "recovery");
      const work = formatStepSize(step, t) ?? "";
      rows.push({
        key: `rep-${i}`,
        label: t.stepKinds.work,
        detail: recovery
          ? fillTemplate(t.repeats, {
              count: String(step.repetition.total),
              work,
              rest: formatStepSize(recovery, t) ?? "",
            })
          : `${step.repetition.total} × ${work}`,
        pace: formatTargetPace(step, units, paceUnit),
        steps: steps.slice(i, j),
      });
      i = j;
      continue;
    }
    rows.push({
      key: `step-${i}`,
      label: t.stepKinds[step.kind],
      detail: formatStepSize(step, t) ?? "",
      pace: formatTargetPace(step, units, paceUnit),
      steps: [step],
    });
    i += 1;
  }
  return rows;
}
