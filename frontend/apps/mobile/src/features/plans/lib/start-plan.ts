import {
  PLAN_NAME_MAX_LENGTH,
  type PlanSaveFields,
  type PlanStartBlock,
  type PlanStartOption,
  type PlanStartOptionKind,
  type PlanStartOptions,
} from "@trefix/api-client";

import { planEndDate } from "./plan-dates";

export type StartChoiceKind = PlanStartOptionKind | "custom";

export type StartChoice = {
  kind: StartChoiceKind;
  startDate: string;
  goalTargetDate?: string;
};

/** A race-aligned option is usable only when the plan fits before the race. */
export function isOptionSelectable(option: PlanStartOption): boolean {
  if (option.kind !== "race_aligned") return true;
  return option.fits !== false && option.reason !== "target_date_passed";
}

/** The server recommendation when it is usable, otherwise the first usable option. */
export function initialStartChoice(
  options: PlanStartOptions,
): StartChoice | null {
  const usable = options.options.filter(isOptionSelectable);
  const recommended =
    usable.find((option) => option.kind === options.recommended) ?? usable[0];
  if (!recommended) return null;
  return {
    kind: recommended.kind,
    startDate: recommended.startDate,
    goalTargetDate: recommended.goalTargetDate,
  };
}

/**
 * Keeps the selection valid when the options change (another race date): a
 * custom date stays, a still selectable option stays with its new dates,
 * anything else falls back to the default choice.
 */
export function reconcileStartChoice(
  current: StartChoice | null,
  options: PlanStartOptions,
): StartChoice | null {
  if (current?.kind === "custom") return current;
  const stillThere =
    current && options.options.find((option) => option.kind === current.kind);
  if (stillThere && isOptionSelectable(stillThere)) {
    return {
      kind: stillThere.kind,
      startDate: stillThere.startDate,
      goalTargetDate: stillThere.goalTargetDate,
    };
  }
  return initialStartChoice(options);
}

/** End date shown next to a start option; a custom date is computed for display only. */
export function choiceEndDate(
  choice: StartChoice,
  options: PlanStartOptions,
): string {
  const option = options.options.find((item) => item.kind === choice.kind);
  if (option && choice.kind !== "custom") return option.endDate;
  return planEndDate(choice.startDate, options.totalWeeks);
}

/**
 * Start payload. `replaceActive` is sent only when the user has actually seen
 * the warning about the plan in progress.
 */
export function buildStartBlock(
  choice: StartChoice,
  input: { replaceActive: boolean; warningShown: boolean; timezone?: string },
): PlanStartBlock {
  return {
    startDate: choice.startDate,
    goalTargetDate: choice.goalTargetDate,
    replaceActive: input.replaceActive && input.warningShown,
    timezone: input.timezone,
  };
}

export type CreationDecision =
  | { kind: "start"; start: PlanStartBlock }
  | { kind: "draft" };

/** Save fields of a creation request: either a draft or create-and-start. */
export function saveFieldsFor(
  decision: CreationDecision,
  meta: { name?: string; notes?: string | null },
): PlanSaveFields {
  // Default names (goal summary, "{name} {year}") may exceed the server limit.
  const name = meta.name?.trim().slice(0, PLAN_NAME_MAX_LENGTH).trim();
  const notes = meta.notes?.trim();
  const base: PlanSaveFields = {
    name: name ? name : undefined,
    notes: notes ? notes : undefined,
  };
  return decision.kind === "draft"
    ? { ...base, saveAsDraft: true }
    : { ...base, start: decision.start };
}
