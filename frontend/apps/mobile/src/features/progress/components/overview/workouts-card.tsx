import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, ChevronRight, X } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

import { type ProgressWorkout } from "../../data/progress-model";
import {
  workoutRowText,
  type ProgressTextContext,
} from "../../lib/progress-text";
import {
  Caption,
  Medal,
  ProgressCard,
  SectionHeader,
  fonts,
  progressPalette,
} from "../progress-ui";

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  workouts: ProgressWorkout[];
  hasPlan: boolean;
  onOpenWorkout: (workoutId: string) => void;
};

/** Latest workouts of the period: date, type, short stats and plan status. */
export function WorkoutsCard({
  theme,
  ctx,
  workouts,
  hasPlan,
  onOpenWorkout,
}: Props) {
  if (workouts.length === 0) return null;
  const t = ctx.copy.progressOverview.workouts;
  const palette = progressPalette(theme);
  const font = fonts(theme);

  return (
    <>
      <SectionHeader theme={theme} title={t.title} />
      <ProgressCard theme={theme} style={styles.card}>
        {workouts.map((workout, index) => {
          const text = workoutRowText(ctx, workout, hasPlan);
          const missed = workout.status === "missed";
          const id = workout.id;
          return (
            <Pressable
              key={`${workout.date}-${index}`}
              accessibilityRole="button"
              disabled={id === null}
              onPress={() => id && onOpenWorkout(id)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: palette.line,
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.day}>
                <Text
                  style={[
                    styles.dayNumber,
                    { color: palette.fg, fontFamily: font.medium },
                  ]}
                >
                  {text.day}
                </Text>
                <Text
                  style={[
                    styles.weekday,
                    { color: palette.muted, fontFamily: font.regular },
                  ]}
                >
                  {text.weekday}
                </Text>
              </View>
              <View style={styles.content}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.title,
                    {
                      color: missed ? palette.muted : palette.fg,
                      fontFamily: font.medium,
                    },
                  ]}
                >
                  {text.title}
                </Text>
                <View style={styles.metaRow}>
                  {workout.status === "plan" && hasPlan ? (
                    <Check
                      size={13}
                      strokeWidth={3}
                      color={palette.fg}
                      accessibilityLabel={t.statusPlan}
                    />
                  ) : null}
                  {missed ? (
                    <X
                      size={12}
                      strokeWidth={3}
                      color={palette.muted}
                      accessibilityLabel={t.statusMissed}
                    />
                  ) : null}
                  <Caption theme={theme} numberOfLines={1} style={styles.meta}>
                    {text.meta}
                  </Caption>
                </View>
                {text.record ? (
                  <View style={styles.record}>
                    <Medal color={palette.fg} />
                    <Text
                      style={[
                        styles.recordText,
                        { color: palette.fg, fontFamily: font.medium },
                      ]}
                    >
                      {text.record}
                    </Text>
                  </View>
                ) : null}
              </View>
              <ChevronRight size={16} color={palette.muted} />
            </Pressable>
          );
        })}
      </ProgressCard>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.7 },
  day: { width: 40, alignItems: "center" },
  dayNumber: { fontSize: 17, lineHeight: 22 },
  weekday: { fontSize: 11, lineHeight: 14 },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  meta: { flexShrink: 1 },
  record: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  recordText: { fontSize: 12, lineHeight: 16 },
});
