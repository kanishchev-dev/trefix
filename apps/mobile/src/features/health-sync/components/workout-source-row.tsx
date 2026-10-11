import { StyleSheet, Text, View } from "react-native";
import { Link2 } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";

import { type ThemeTokens } from "@workspace/tokens";

import { getWorkoutSources } from "../../../lib/integrations-api";
import { fillTemplate, type MainCopy } from "../../../locales";

type Props = {
  workoutId: string;
  copy: MainCopy;
  theme: ThemeTokens;
};

function providerName(provider: string, copy: MainCopy): string {
  const h = copy.profile.integrations.health;
  switch (provider) {
    case "apple_health":
      return h.appleTitle;
    case "health_connect":
      return h.connectTitle;
    case "strava":
      return "Strava";
    case "garmin":
      return "Garmin";
    case "trefix":
      return "Trefix";
    default:
      return provider;
  }
}

/** "Source: Apple Health · Apple Watch and 1 more" for an imported workout; nothing for manual ones. */
export function WorkoutSourceRow({ workoutId, copy, theme }: Props) {
  const { data } = useQuery({
    queryKey: ["workouts", "sources", workoutId],
    queryFn: () => getWorkoutSources(workoutId),
    staleTime: 60_000,
  });
  const items = data?.items ?? [];
  const primary = items[0];
  if (!primary) return null;

  const h = copy.profile.integrations.health;
  const parts = [providerName(primary.provider, copy), primary.originDevice].filter(Boolean).join(" · ");
  const more = items.length > 1 ? ` ${fillTemplate(h.sourceMore, { count: items.length - 1 })}` : "";

  return (
    <View style={styles.row}>
      <Link2 color={theme.color.mutedForeground} size={16} />
      <Text style={[styles.text, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
        {h.sourceLabel}: {parts}
        {more}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
});
