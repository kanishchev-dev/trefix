import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type PlanChangePreview } from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import {
  buildDiffSummary,
  buildDiffWeeks,
  warningText,
  type DiffLine,
  type WorkoutDescriber,
} from "../lib/plan-diff";
import { Notice } from "./plans-ui";

const COLLAPSED_WEEKS = 5;

type Props = {
  preview: PlanChangePreview;
  describeWorkout?: WorkoutDescriber;
  copy: MainCopy;
  language: AppLanguage;
  theme: ThemeTokens;
};

/** "What changes" of a plan: summary, warnings and the changed weeks. */
export function PlanDiffView({
  preview,
  describeWorkout,
  copy,
  language,
  theme,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const context = { copy, language };
  const summary = useMemo(
    () =>
      buildDiffSummary(preview.diff, context, {
        resultingEndDate: preview.resultingEndDate,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, copy, language],
  );
  const weeks = useMemo(
    () =>
      buildDiffWeeks(
        preview.diff,
        context,
        shortDayNamesFor(language),
        describeWorkout,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, copy, language, describeWorkout],
  );
  const visibleWeeks = expanded ? weeks : weeks.slice(0, COLLAPSED_WEEKS);
  const empty = summary.length === 0 && weeks.length === 0;

  return (
    <View style={styles.root}>
      {preview.warnings.map((code) => (
        <Notice key={code} tone="warning" theme={theme}>
          {warningText(code, copy)}
        </Notice>
      ))}

      {empty ? (
        <DiffText
          line={{
            text: copy.plans.diff.noChanges,
            accessibilityLabel: copy.plans.diff.noChanges,
          }}
          theme={theme}
        />
      ) : null}

      {summary.map((line) => (
        <DiffText key={line.text} line={line} theme={theme} bullet />
      ))}

      {visibleWeeks.map((week) => (
        <View key={week.weekNumber} style={styles.week}>
          <Text
            style={[
              styles.weekTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {week.title}
          </Text>
          {week.lines.map((line, index) => (
            <DiffText
              key={`${week.weekNumber}-${index}`}
              line={line}
              theme={theme}
            />
          ))}
        </View>
      ))}

      {!expanded && weeks.length > COLLAPSED_WEEKS ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setExpanded(true)}
        >
          <Text
            style={[
              styles.more,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {fillTemplate(copy.plans.diff.showAll, { count: weeks.length })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function DiffText({
  line,
  theme,
  bullet = false,
}: {
  line: DiffLine;
  theme: ThemeTokens;
  bullet?: boolean;
}) {
  const color =
    line.tone === "removed"
      ? theme.color.danger
      : line.tone === "added"
        ? theme.color.foreground
        : theme.color.mutedForeground;
  return (
    <Text
      accessibilityLabel={line.accessibilityLabel}
      style={[
        styles.line,
        {
          color: bullet ? theme.color.foreground : color,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      {bullet ? `• ${line.text}` : line.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  week: {
    gap: 2,
  },
  weekTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  line: {
    fontSize: 14,
    lineHeight: 20,
  },
  more: {
    fontSize: 14,
    lineHeight: 20,
  },
});
