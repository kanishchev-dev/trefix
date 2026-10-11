import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { withAlpha, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import type { UnitSystem } from "../../../shared/lib/units";
import type { EngineView } from "../engine/types";
import { formatClock } from "../format";
import { formatStepSize, formatTargetPace } from "../plan-format";

type Props = {
  view: EngineView;
  theme: ThemeTokens;
  copy: MainCopy;
  units: UnitSystem;
  paceUnit: string;
  skipIcon: ReactNode;
  /** Absent while the screen is locked. */
  onSkip?: () => void;
};

/** The running step of a planned workout: what is left of it, the target pace and what comes next. */
export function StepCard({
  view,
  theme,
  copy,
  units,
  paceUnit,
  skipIcon,
  onSkip,
}: Props) {
  const t = copy.tracker;
  const s = t.step;
  const regular = theme.typography.fontFamily.sans.regular;
  const medium = theme.typography.fontFamily.sans.medium;
  const semibold = theme.typography.fontFamily.sans.semibold;
  const muted = { color: theme.color.mutedForeground, fontFamily: regular };
  const card = {
    backgroundColor: theme.color.card,
    borderColor: theme.color.border,
  };

  const progress = view.step;
  if (!progress) {
    return (
      <View style={[styles.card, card]}>
        <Text
          style={[
            styles.title,
            { color: theme.color.success, fontFamily: medium },
          ]}
        >
          {s.done}
        </Text>
        <Text style={[styles.small, muted]}>{s.doneHint}</Text>
      </View>
    );
  }

  const { step, next } = progress;
  const kind = t.stepKinds[step.kind];
  const title =
    step.repetition && step.kind === "work"
      ? `${kind} · ${fillTemplate(s.repetition, { index: step.repetition.index, total: step.repetition.total })}`
      : kind;
  const remaining =
    progress.remainingSec !== null
      ? formatClock(progress.remainingSec * 1000)
      : progress.remainingM !== null
        ? `${progress.remainingM} ${t.units.m}`
        : null;
  const target = formatTargetPace(step, units, paceUnit);
  const status = view.paceStatus;
  const statusColor =
    status === "in" ? theme.color.success : theme.color.warning;
  const nextText = next
    ? fillTemplate(s.next, {
        step: [t.stepKinds[next.kind], formatStepSize(next, t)]
          .filter(Boolean)
          .join(" "),
      })
    : s.last;

  return (
    <View style={[styles.card, card]}>
      <View style={styles.row}>
        <Text style={[styles.small, muted]}>
          {fillTemplate(s.of, {
            current: progress.index + 1,
            total: progress.total,
          })}
        </Text>
        {status ? (
          <View
            style={[
              styles.pill,
              { backgroundColor: withAlpha(statusColor, 0.15) },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text
              style={[
                styles.pillText,
                { color: statusColor, fontFamily: medium },
              ]}
            >
              {s.pace[status]}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.row}>
        <Text
          style={[
            styles.title,
            styles.flex,
            { color: theme.color.foreground, fontFamily: medium },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {remaining ? (
          <Text
            style={[
              styles.remaining,
              { color: theme.color.foreground, fontFamily: semibold },
            ]}
            accessibilityLabel={`${s.remaining} ${remaining}`}
          >
            {remaining}
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.color.segmentedTrack }]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(progress.fraction * 100)}%`,
              backgroundColor: theme.color.primary,
            },
          ]}
        />
      </View>

      {target ? (
        <Text
          style={[
            styles.small,
            { color: theme.color.foreground, fontFamily: medium },
          ]}
        >
          {s.target} {target}
        </Text>
      ) : null}

      <View style={styles.row}>
        <Text style={[styles.small, styles.flex, muted]} numberOfLines={1}>
          {nextText}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.skip}
          disabled={!onSkip}
          onPress={onSkip}
          hitSlop={8}
          style={({ pressed }) => [
            styles.skip,
            { backgroundColor: theme.color.controlSecondary },
            !onSkip && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {skipIcon}
          <Text
            style={[
              styles.skipText,
              { color: theme.color.foreground, fontFamily: medium },
            ]}
          >
            {s.skip}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  flex: { flex: 1 },
  small: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 18, lineHeight: 24 },
  remaining: { fontSize: 30, lineHeight: 36, fontVariant: ["tabular-nums"] },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, lineHeight: 16 },
  skip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: { fontSize: 13, lineHeight: 18 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
