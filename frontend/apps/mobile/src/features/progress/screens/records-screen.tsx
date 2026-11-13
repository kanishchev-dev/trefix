import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type RecordAttempt, type RecordDistance } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { trackEvent } from "../../../lib/analytics";
import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import { HeaderPlusButton } from "../../main/components/header";
import { SheetActionsColumn } from "../../plans/components/plans-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../../profile/components/profile-sub-screen";
import { AddResultSheet } from "../components/add-result-sheet";
import { LineChart } from "../components/line-chart";
import { sourceLabel } from "../components/progress-sections";
import {
  useProgressMutation,
  useRecordHistory,
  useRecords,
} from "../hooks/use-progress-v2";
import {
  dayMonth,
  distanceLabel,
  formatDuration,
} from "../lib/progress-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

/** All-time bests per distance with forecasts and the attempt history of the selected one. */
export function RecordsScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const r = copy.progress.recordsScreen;
  const records = useRecords();
  const [selected, setSelected] = useState<RecordDistance | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<RecordAttempt | null>(null);
  const history = useRecordHistory(selected);
  const mutation = useProgressMutation();
  const { showToast } = useToast();

  const items = useMemo(() => records.data ?? [], [records.data]);

  useEffect(() => {
    if (selected === null && items.length > 0) {
      setSelected((items.find((item) => item.best) ?? items[0]).distance);
    }
  }, [items, selected]);

  const attempts = history.data?.attempts ?? [];
  const sorted = [...attempts].sort((a, b) => a.date.localeCompare(b.date));
  const first =
    sorted.length > 0 ? new Date(`${sorted[0].date}T00:00:00Z`).getTime() : 0;
  const last =
    sorted.length > 0
      ? new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`).getTime()
      : 0;
  const points = sorted.map((attempt) => ({
    x:
      last > first
        ? (new Date(`${attempt.date}T00:00:00Z`).getTime() - first) /
          (last - first)
        : 0.5,
    y: attempt.seconds,
  }));

  const runAction = async () => {
    const target = actionTarget;
    if (!target) return;
    setActionTarget(null);
    try {
      if (target.source === "result" && target.resultId) {
        await mutation.mutateAsync({
          kind: "delete",
          resultId: target.resultId,
        });
        trackEvent("progress_result_deleted", { distance: selected ?? "" });
      } else if (target.workoutId) {
        await mutation.mutateAsync({
          kind: "exclude",
          workoutId: target.workoutId,
          excluded: true,
        });
        trackEvent("progress_record_excluded", { distance: selected ?? "" });
      }
    } catch {
      showToast(copy.progress.errors.generic);
    }
  };

  const text = (weight: "regular" | "medium" | "semibold") => ({
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans[weight],
  });
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };

  return (
    <ProfileSubScreen
      title={r.title}
      onBack={onBack}
      rightAction={
        <HeaderPlusButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setAddOpen(true)}
        />
      }
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <View style={[styles.table, { backgroundColor: theme.color.card }]}>
          <View style={styles.tableRow}>
            <Text style={[styles.colName, styles.headCell, muted]}>
              {r.distance}
            </Text>
            <Text style={[styles.colValue, styles.headCell, muted]}>
              {r.best}
            </Text>
            <Text style={[styles.colValue, styles.headCell, muted]}>
              {r.prediction}
            </Text>
          </View>
          {items.map((item) => {
            const active = item.distance === selected;
            return (
              <Pressable
                key={item.distance}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(item.distance)}
                style={({ pressed }) => [
                  styles.tableRow,
                  styles.bodyRow,
                  { borderTopColor: theme.color.separator },
                  active && { backgroundColor: theme.color.surface },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.colName, styles.cell, text("medium")]}
                >
                  {distanceLabel(copy, item.distance)}
                </Text>
                <Text
                  style={[
                    styles.colValue,
                    styles.cell,
                    item.best ? text("semibold") : muted,
                  ]}
                >
                  {item.best ? formatDuration(item.best.seconds) : "—"}
                </Text>
                <Text style={[styles.colValue, styles.cell, muted]}>
                  {item.predictionSeconds
                    ? `~${formatDuration(item.predictionSeconds)}`
                    : "—"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Footnote text={r.footnote} theme={theme} />
      </ProfileSection>

      {selected ? (
        <ProfileSection>
          <SectionTitle
            text={fillTemplate(r.history, {
              distance: distanceLabel(copy, selected),
            })}
            theme={theme}
          />
          {attempts.length > 0 ? (
            <>
              {points.length > 1 ? (
                <View
                  style={[
                    styles.chartCard,
                    { backgroundColor: theme.color.card },
                  ]}
                >
                  <LineChart
                    points={points}
                    invert
                    height={96}
                    theme={theme}
                    accessibilityLabel={fillTemplate(r.history, {
                      distance: distanceLabel(copy, selected),
                    })}
                  />
                  <View style={styles.chartLabels}>
                    <Text style={[styles.small, muted]}>
                      {dayMonth(sorted[0].date, language, true)}
                    </Text>
                    <Text style={[styles.small, muted]}>
                      {dayMonth(sorted[sorted.length - 1].date, language, true)}
                    </Text>
                  </View>
                </View>
              ) : null}
              <ListCard theme={theme}>
                {[...sorted].reverse().map((attempt) => (
                  <Pressable
                    key={attempt.id}
                    accessibilityRole="button"
                    accessibilityHint={r.excludeFootnote}
                    delayLongPress={350}
                    onLongPress={() => setActionTarget(attempt)}
                  >
                    <ListRow
                      theme={theme}
                      title={
                        attempt.name ??
                        sourceLabel(
                          copy,
                          attempt.provider,
                          attempt.kind,
                          attempt.source,
                        )
                      }
                      description={[
                        dayMonth(attempt.date, language, true),
                        attempt.name
                          ? sourceLabel(
                              copy,
                              attempt.provider,
                              attempt.kind,
                              attempt.source,
                            )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      value={formatDuration(attempt.seconds)}
                      chevron={false}
                    />
                  </Pressable>
                ))}
              </ListCard>
              <Footnote text={r.excludeFootnote} theme={theme} />
            </>
          ) : history.isLoading ? null : (
            <ListCard theme={theme}>
              <ListRow theme={theme} title={r.noAttempts} />
            </ListCard>
          )}
        </ProfileSection>
      ) : null}

      <BottomSheet
        visible={actionTarget !== null}
        onClose={() => setActionTarget(null)}
        theme={theme}
        themeMode={themeMode}
      >
        <View style={styles.sheetContent}>
          <SheetBlock theme={theme}>
            <SheetActionsColumn>
              <SheetButton
                label={actionTarget?.source === "result" ? r.delete : r.exclude}
                variant="destructive"
                onPress={() => void runAction()}
                theme={theme}
                themeMode={themeMode}
              />
              <SheetButton
                label={r.cancel}
                variant="secondary"
                onPress={() => setActionTarget(null)}
                theme={theme}
                themeMode={themeMode}
              />
            </SheetActionsColumn>
          </SheetBlock>
        </View>
      </BottomSheet>

      <AddResultSheet
        visible={addOpen}
        initialDistance={selected}
        onClose={() => setAddOpen(false)}
        copy={copy}
        language={language}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  table: { borderRadius: 24, overflow: "hidden", paddingVertical: 4 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 8,
  },
  bodyRow: { minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth },
  headCell: { fontSize: 12, lineHeight: 16, paddingVertical: 10 },
  cell: { fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  colName: { flex: 1.3, minWidth: 0 },
  colValue: { flex: 1, textAlign: "right" },
  chartCard: { borderRadius: 24, padding: 18, gap: 8 },
  chartLabels: { flexDirection: "row", justifyContent: "space-between" },
  small: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.82 },
  sheetContent: { gap: 16, paddingTop: 24, paddingBottom: 32, width: "100%" },
});
