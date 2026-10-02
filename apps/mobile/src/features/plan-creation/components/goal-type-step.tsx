import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Activity,
  Award,
  CheckCircle2,
  Compass,
  Dumbbell,
  Flame,
  Heart,
  HelpCircle,
  MapPin,
  Mountain,
  RotateCcw,
  Scale,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react-native";

import {
  ATHLETE_GOAL_CATEGORIES,
  ATHLETE_GOAL_TYPES,
  GOAL_TYPE_CATEGORY,
  type AthleteGoalCategory,
  type AthleteGoalType,
} from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import { OptionChip } from "./plan-creation-ui";

type Props = {
  selectedType: AthleteGoalType;
  theme: ThemeTokens;
  copy: MainCopy;
  onSelectType: (goalType: AthleteGoalType) => void;
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

export function GoalTypeStep({
  selectedType,
  theme,
  copy,
  onSelectType,
}: Props) {
  const creationCopy = copy.plan.creation;
  const categoriesCopy = creationCopy.categories;
  const goalTypesCopy = creationCopy.goalTypes;
  const descriptionsCopy = creationCopy.goalDescriptions;

  const [activeCategory, setActiveCategory] = useState<AthleteGoalCategory | "all">(
    GOAL_TYPE_CATEGORY[selectedType] || "all",
  );

  const filteredTypes = useMemo(() => {
    if (activeCategory === "all") {
      return ATHLETE_GOAL_TYPES;
    }
    return ATHLETE_GOAL_TYPES.filter(
      (type) => GOAL_TYPE_CATEGORY[type] === activeCategory,
    );
  }, [activeCategory]);

  return (
    <View style={styles.container}>
      {/* Category filter tabs */}
      <SheetBlock theme={theme} edgeToEdge>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          <OptionChip
            label={copy.progress.milestones.viewAll}
            selected={activeCategory === "all"}
            theme={theme}
            onPress={() => setActiveCategory("all")}
          />
          {ATHLETE_GOAL_CATEGORIES.map((cat) => (
            <OptionChip
              key={cat}
              label={categoriesCopy[cat as keyof typeof categoriesCopy] ?? cat}
              selected={activeCategory === cat}
              theme={theme}
              onPress={() => setActiveCategory(cat)}
            />
          ))}
        </ScrollView>
      </SheetBlock>

      {/* Goal types list */}
      <SheetBlock theme={theme}>
        <View style={styles.typesList}>
          {filteredTypes.map((goalType) => {
            const selected = selectedType === goalType;
            const title =
              goalTypesCopy[goalType as keyof typeof goalTypesCopy] ?? goalType;
            const description =
              descriptionsCopy[goalType as keyof typeof descriptionsCopy] ?? "";

            return (
              <Pressable
                key={goalType}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelectType(goalType)}
                style={({ pressed }) => [
                  styles.typeCard,
                {
                  backgroundColor: selected
                    ? theme.color.surfaceElevated
                    : theme.color.surface,
                  borderColor: selected ? theme.color.primary : theme.color.border,
                  borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: selected
                      ? theme.color.primary
                      : theme.color.surfaceElevated,
                  },
                ]}
              >
                {getGoalIcon(
                  goalType,
                  selected
                    ? theme.color.primaryForeground
                    : theme.color.mutedForeground,
                )}
              </View>

              <View style={styles.textWrap}>
                <Text
                  style={[
                    styles.typeTitle,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {title}
                </Text>

                {description ? (
                  <Text
                    style={[
                      styles.typeDesc,
                      {
                        color: theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.regular,
                      },
                    ]}
                  >
                    {description}
                  </Text>
                ) : null}
              </View>

              {selected ? (
                <View
                  style={[
                    styles.selectedBadge,
                    { backgroundColor: theme.color.primary },
                  ]}
                >
                  <CheckCircle2 color={theme.color.primaryForeground} size={16} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </SheetBlock>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  categoriesScroll: {
    maxHeight: 44,
  },
  categoriesContent: {
    gap: 8,
    paddingHorizontal: 20,
  },
  typesList: {
    gap: 10,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  typeTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  typeDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  selectedBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
