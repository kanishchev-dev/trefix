import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Sparkles } from "lucide-react-native";

import { type PlanAdaptation } from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { adaptationReason, adaptationTitle } from "../../plans/lib/plan-texts";

type Props = {
  adaptation: PlanAdaptation;
  theme: ThemeTokens;
  copy: MainCopy;
  onPress: (adaptation: PlanAdaptation) => void;
};

/** The latest change the coach made to the plan; the only coloured row of the screen. */
export function CoachAdaptationRow({
  adaptation,
  theme,
  copy,
  onPress,
}: Props) {
  const t = copy.plan.screen.coach;
  const title =
    adaptation.weekNumber !== undefined
      ? fillTemplate(t.weekTitle, { number: adaptation.weekNumber })
      : t.planTitle;
  const detail = [
    adaptationTitle(adaptation.type, copy),
    adaptationReason(adaptation.reason, copy),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => onPress(adaptation)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.color.card,
          borderColor: theme.color.aiSurface,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.color.aiSurface }]}>
        <Sparkles size={18} color={theme.color.ai} />
      </View>
      <View style={styles.text}>
        <Text
          style={[
            styles.title,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            numberOfLines={2}
            style={[
              styles.detail,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={theme.color.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
  },
});
