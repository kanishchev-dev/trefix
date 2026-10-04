import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Activity,
  Award,
  CheckCircle2,
  Compass,
  Dumbbell,
  Flame,
  Heart,
  MapPin,
  Mountain,
  RotateCcw,
  Scale,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react-native";
import { type AthleteGoalType } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

type GoalTypeCardProps = {
  goalType: AthleteGoalType;
  title: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
};

function getGoalIcon(type: AthleteGoalType, color: string) {
  const size = 20;
  switch (type) {
    case "prepare_for_race":
    case "improve_race_result":
      return <Trophy color={color} size={size} />;
    case "run_new_distance":
      return <MapPin color={color} size={size} />;
    case "trail_preparation":
    case "improve_hills":
      return <Mountain color={color} size={size} />;
    case "ultra_preparation":
    case "backyard_preparation":
      return <Compass color={color} size={size} />;
    case "improve_speed":
    case "improve_pace":
      return <Zap color={color} size={size} />;
    case "build_endurance":
    case "increase_running_volume":
      return <Activity color={color} size={size} />;
    case "improve_aerobic_fitness":
    case "general_health":
      return <Heart color={color} size={size} />;
    case "start_running":
      return <Flame color={color} size={size} />;
    case "return_to_running":
      return <RotateCcw color={color} size={size} />;
    case "build_consistency":
    case "run_continuously":
      return <CheckCircle2 color={color} size={size} />;
    case "lose_weight":
      return <Scale color={color} size={size} />;
    case "maintain_fitness":
      return <Dumbbell color={color} size={size} />;
    case "complete_challenge":
      return <Award color={color} size={size} />;
    case "custom":
    default:
      return <Sparkles color={color} size={size} />;
  }
}

export function GoalTypeCard({
  goalType,
  title,
  theme,
  themeMode,
  onPress,
}: GoalTypeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeCard,
        {
          backgroundColor: theme.color.control,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor:
              themeMode === "dark" ? "rgba(255, 255, 255, 0.06)" : theme.color.surfaceElevated,
          },
        ]}
      >
        {getGoalIcon(goalType, theme.color.mutedForeground)}
      </View>

      <View style={styles.textWrap}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.typeTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderRadius: 24,
    gap: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  typeTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
});
