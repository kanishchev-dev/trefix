import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";
import { formatHoursMinutesSeconds, formatMinutesSeconds } from "@trefix/utils";

import { SheetTabs } from "../../../../shared/ui/sheet-controls";
import {
  fillTemplate,
  formatDayMonth,
  formatDateLong,
  getShortMonthName,
} from "../../../../locales";
import {
  type ProgressAnalytics,
  type ProgressPaceType,
} from "../../data/progress-model";
import { parseYmd } from "../../lib/progress-selectors";
import { type ProgressTextContext } from "../../lib/progress-text";
import {
  Caption,
  ProgressCard,
  SectionHeader,
  Track,
  fonts,
  progressPalette,
  progressStyles,
} from "../progress-ui";

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  analytics: ProgressAnalytics;
};

type FormDistance = "5" | "10";

/** Time trials and races on one distance, oldest first; the latest is highlighted. */
export function FormBlock({ theme, ctx, analytics }: Props) {
  const [distance, setDistance] = useState<FormDistance>("10");
  const t = ctx.copy.progressOverview.analytics.form;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const efforts = analytics.form[distance];
  const times = efforts.map((effort) => effort.seconds);
  const slowest = Math.max(...times);
  const fastest = Math.min(...times);
  const spread = slowest - fastest || 1;
  const first = efforts[0];
  const last = efforts[efforts.length - 1];

  let summary: string | null = null;
  if (first && last && efforts.length > 1) {
    const diff = first.seconds - last.seconds;
    const { year, month, day } = parseYmd(first.date);
    summary = fillTemplate(diff >= 0 ? t.faster : t.slower, {
      value: formatHoursMinutesSeconds(Math.abs(diff)),
      date: formatDateLong(new Date(year, month, day), ctx.language),
    });
  }

  return (
    <>
      <SectionHeader theme={theme} title={t.title} aside={t.hint} />
      <ProgressCard theme={theme} style={[progressStyles.cardBody, styles.gap]}>
        <SheetTabs
          tabs={(["5", "10"] as FormDistance[]).map((value) => ({
            key: value,
            label: ctx.format.distance(Number(value), 0),
          }))}
          value={distance}
          onChange={setDistance}
          theme={theme}
          trackColor={theme.color.screen}
        />
        {efforts.length === 0 ? (
          <Caption theme={theme}>{t.empty}</Caption>
        ) : (
          efforts.map((effort, index) => {
            const isLast = index === efforts.length - 1;
            return (
              <View key={effort.date} style={styles.formRow}>
                <Caption
                  theme={theme}
                  numberOfLines={1}
                  style={styles.formDate}
                >
                  {formatDayMonth(effort.date, ctx.language)}
                </Caption>
                <View style={styles.formTrack}>
                  <Track
                    theme={theme}
                    height={8}
                    percent={55 + (45 * (slowest - effort.seconds)) / spread}
                    color={isLast ? palette.fg : palette.mid}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.formValue,
                    {
                      color: palette.fg,
                      fontFamily: isLast ? font.medium : font.regular,
                    },
                  ]}
                >
                  {formatHoursMinutesSeconds(effort.seconds)}
                </Text>
              </View>
            );
          })
        )}
        {summary ? (
          <Text
            style={[
              progressStyles.body,
              { color: palette.fg, fontFamily: font.medium },
            ]}
          >
            {summary}
          </Text>
        ) : null}
        <Caption theme={theme}>{t.note}</Caption>
      </ProgressCard>
    </>
  );
}

const PACE_TYPES: ProgressPaceType[] = ["easy", "tempo", "interval"];

/** Average pace by month inside one workout type; a taller bar is a faster pace. */
export function PaceBlock({ theme, ctx, analytics }: Props) {
  const [type, setType] = useState<ProgressPaceType>("easy");
  const t = ctx.copy.progressOverview.analytics.pace;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const months = analytics.pace[type];
  const paces = months.map((item) => item.secPerKm);
  const slowest = Math.max(...paces);
  const spread = slowest - Math.min(...paces) || 1;
  const first = months[0];
  const last = months[months.length - 1];

  let summary: string | null = null;
  if (first && last && months.length > 1) {
    const diff = Math.round(first.secPerKm - last.secPerKm);
    summary = fillTemplate(diff >= 0 ? t.faster : t.slower, {
      type: t.types[type],
      value: Math.abs(diff),
      month: ctx.copy.progressOverview.monthsIn[first.month] ?? "",
    });
  }

  return (
    <>
      <SectionHeader theme={theme} title={t.title} aside={t.hint} />
      <ProgressCard theme={theme} style={[progressStyles.cardBody, styles.gap]}>
        <SheetTabs
          tabs={PACE_TYPES.map((value) => ({
            key: value,
            label: t.types[value],
          }))}
          value={type}
          onChange={setType}
          theme={theme}
          trackColor={theme.color.screen}
        />
        <View style={styles.paceBars}>
          {months.map((item, index) => {
            const isLast = index === months.length - 1;
            const color = isLast ? palette.fg : palette.muted;
            return (
              <View key={item.month} style={styles.paceColumn}>
                <Text
                  numberOfLines={1}
                  style={[styles.paceValue, { color, fontFamily: font.medium }]}
                >
                  {formatMinutesSeconds(item.secPerKm)}
                </Text>
                <View
                  style={[
                    styles.paceBar,
                    {
                      height: Math.round(
                        30 + (54 * (slowest - item.secPerKm)) / spread,
                      ),
                      backgroundColor: isLast ? palette.fg : palette.faint,
                    },
                  ]}
                />
                <Caption theme={theme} numberOfLines={1}>
                  {getShortMonthName(item.month, ctx.language)}
                </Caption>
              </View>
            );
          })}
        </View>
        {summary ? (
          <Text
            style={[
              progressStyles.body,
              { color: palette.fg, fontFamily: font.medium },
            ]}
          >
            {summary}
          </Text>
        ) : null}
        <Caption theme={theme}>{t.note}</Caption>
      </ProgressCard>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 14, paddingTop: 14 },
  formRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  formDate: { width: 64 },
  formTrack: { flex: 1, minWidth: 0 },
  formValue: { width: 64, textAlign: "right", fontSize: 15, lineHeight: 20 },
  paceBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    height: 120,
  },
  paceColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  paceValue: { fontSize: 12, lineHeight: 16 },
  paceBar: { width: "100%", borderRadius: 4 },
});
