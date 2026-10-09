import React from "react";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import { Activity, Flame, Zap, Mountain, Trophy } from "lucide-react-native";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";
import { type ManualWorkoutType } from "./workout-goal-sheet";
import { type MainCopy } from "../../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onSelectType: (type: ManualWorkoutType) => void;
};

const WORKOUT_TYPES: Array<{
  key: ManualWorkoutType;
  icon: React.ComponentType<{ size: number; color: string }>;
}> = [
  { key: "easy", icon: Activity },
  { key: "tempo", icon: Flame },
  { key: "interval", icon: Zap },
  { key: "hill", icon: Mountain },
  { key: "race", icon: Trophy },
];

export const AddWorkoutSection = React.memo(
  ({ theme, themeMode, copy, onSelectType }: Props) => {
    const typesCopy = copy?.today?.types || {};
    const title = copy?.today?.addSectionTitle || "Добавить тренировку";
    const isDark = themeMode === "dark";

    const getDefaultLabel = (key: ManualWorkoutType) => {
      switch (key) {
        case "easy":
          return "Легкий бег";
        case "tempo":
          return "Темповая";
        case "interval":
          return "Интервалы";
        case "hill":
          return "Горки";
        case "race":
          return "Гонка";
      }
    };

    return (
      <View style={styles.container}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sliderContent}
        >
          {WORKOUT_TYPES.map(({ key, icon: Icon }) => {
            const label = typesCopy[key] || getDefaultLabel(key);

            return (
              <Pressable
                key={key}
                accessibilityLabel={`${title}: ${label}`}
                accessibilityRole="button"
                onPress={() => onSelectType(key)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: theme.color.card,
                    borderColor: theme.color.cardBorder,
                  },
                  pressed && styles.cardPressed,
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: theme.color.iconSurface },
                  ]}
                >
                  <Icon size={20} color={theme.color.primary} />
                </View>

                <Text
                  numberOfLines={2}
                  style={[
                    styles.cardLabel,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  sliderContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 120,
    height: 110,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    justifyContent: "space-between",
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
});
