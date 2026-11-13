import { StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";
import { useWorkoutCoachNote } from "../use-workout-coach-note";

type Props = {
  workoutId: string;
  /** Off when the coach is switched off in settings: no request at all. */
  enabled: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/** Tref's note under a workout; hidden when there is nothing to show. */
export function WorkoutCoachNote({
  workoutId,
  enabled,
  theme,
  themeMode,
  copy,
}: Props) {
  const { data, isError } = useWorkoutCoachNote(workoutId, enabled);
  const t = copy.today.details.coachNote;

  if (!enabled || isError || !data || data.status === "disabled") {
    return null;
  }

  const isPending = data.status === "pending" || !data.content;

  return (
    <Card size="sm" theme={theme} themeMode={themeMode}>
      <View style={styles.header}>
        <View
          style={[styles.avatar, { backgroundColor: theme.color.aiSurface }]}
        >
          <Sparkles size={16} color={theme.color.ai} strokeWidth={2.1} />
        </View>
        <View style={styles.headerText}>
          <Text
            style={[
              styles.name,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {t.author}
          </Text>
          <Text
            style={[
              styles.role,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {isPending ? t.writing : t.role}
          </Text>
        </View>
      </View>
      {isPending ? (
        <View style={styles.skeleton}>
          {[1, 0.86, 0.6].map((width) => (
            <View
              key={width}
              style={[
                styles.skeletonLine,
                {
                  width: `${width * 100}%`,
                  backgroundColor: theme.color.skeleton,
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Text
          style={[
            styles.body,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {data.content}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
  },
  role: {
    fontSize: 13,
    lineHeight: 18,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  skeleton: {
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
});
