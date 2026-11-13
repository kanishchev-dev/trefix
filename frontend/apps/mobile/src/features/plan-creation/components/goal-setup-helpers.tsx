import { type ReactNode } from "react";
import { View } from "react-native";
import { type GoalChallengeMetric } from "@trefix/api-client";

export type Metrics = Record<string, unknown>;

/** A block plus whether it is a collapsed "+ Add …" link (gets a tight gap). */
export type Item = ReactNode | { node: ReactNode; compact: boolean };

export const isTagged = (
  item: Item,
): item is { node: ReactNode; compact: boolean } =>
  typeof item === "object" &&
  item !== null &&
  "compact" in (item as object) &&
  "node" in (item as object);

/**
 * Vertical stack with two rhythms: `gap` between full blocks and `compactGap`
 * in front of collapsed links, so a row of "+ Add …" links stays together.
 */
export function Stack({
  items,
  gap,
  compactGap,
}: {
  items: Item[];
  gap: number;
  compactGap: number;
}) {
  const visible = items.filter(
    (item) => item !== null && item !== undefined && item !== false,
  );
  return (
    <View>
      {visible.map((item, index) => {
        const compact = isTagged(item) && item.compact;
        const node = isTagged(item) ? item.node : item;
        return (
          <View
            key={index}
            style={
              index === 0
                ? undefined
                : { marginTop: compact ? compactGap : gap }
            }
          >
            {node}
          </View>
        );
      })}
    </View>
  );
}

export const SECTION_GAP = 56;

export const FIELD_GAP = 44;

export const COMPACT_GAP = 8;

export type Kind = "target" | "current";

export const RUNS_PER_WEEK_SEGMENTS = [1, 2, 3, 4, 5, 6, 7].map((num) => ({
  label: String(num),
  value: num,
}));

/** Ruler scale per challenge metric (values in the metric's own unit). */
export const CHALLENGE_SCALES: Record<
  GoalChallengeMetric,
  { min: number; max: number; step: number; fallback: number }
> = {
  total_distance: { min: 10, max: 5000, step: 10, fallback: 100 },
  total_duration: { min: 1, max: 1000, step: 1, fallback: 20 },
  runs_count: { min: 1, max: 365, step: 1, fallback: 20 },
  active_days: { min: 1, max: 365, step: 1, fallback: 20 },
};

/** Default plan target date: a typical 12-week plan from today. */
export function defaultTargetDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 12 * 7);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export type DurationUnits = { h: string; min: string };

/** Formats minutes as "1 ч 30 мин" / "1 h 30 min" using localized units. */
export function formatDuration(minutes: number, units: DurationUnits): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ${units.h} ${mins} ${units.min}`;
  if (hours > 0) return `${hours} ${units.h}`;
  return `${mins} ${units.min}`;
}

export const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
