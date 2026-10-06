import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type PlanDiff } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";
import { buildDiffSummary, warningText } from "../lib/plan-diff";
import { DiffText } from "./plan-diff-view";
import { Notice } from "./plans-ui";

type Props = {
  diff: PlanDiff;
  mode: "rebased" | "regenerated";
  warnings: string[];
  metricsVolume?: { before?: number | null; after?: number | null };
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** "What changed vs the previous plan" at the top of a rebuild preview. */
export function PlanDiffSummaryCard({ diff, mode, warnings, metricsVolume, theme, themeMode, copy, language }: Props) {
  const lines = useMemo(
    () => buildDiffSummary(diff, { copy, language }, { metricsVolume }),
    [copy, diff, language, metricsVolume],
  );

  return (
    <View style={styles.root}>
      {mode === "regenerated" ? <Notice theme={theme}>{copy.plans.diff.regenerated}</Notice> : null}
      {warnings
        .filter((code) => !(mode === "regenerated" && code === "STRUCTURE_CHANGED_REGENERATED"))
        .map((code) => (
          <Notice key={code} tone="warning" theme={theme}>
            {warningText(code, copy)}
          </Notice>
        ))}
      {lines.length > 0 ? (
        <Card size="sm" theme={theme} themeMode={themeMode} style={styles.card}>
          <Text style={[styles.title, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold }]}>
            {copy.plans.diff.rebuildTitle}
          </Text>
          {lines.map((line) => (
            <DiffText key={line.text} line={line} theme={theme} />
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  card: {
    gap: 6,
    borderRadius: 32,
    padding: 20,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
});
