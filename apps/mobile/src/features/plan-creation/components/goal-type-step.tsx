import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import {
  ATHLETE_GOAL_CATEGORIES,
  ATHLETE_GOAL_TYPES,
  GOAL_TYPE_CATEGORY,
  type AthleteGoalCategory,
  type AthleteGoalType,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { SheetBlock, SheetButton } from "../../../shared/ui/bottom-sheet";
import { OptionChip } from "./plan-creation-ui";
import { GoalTypeCard } from "./goal-type-card";

type Props = {
  selectedType: AthleteGoalType;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onSelectType: (goalType: AthleteGoalType) => void;
  onCancel: () => void;
};

export function GoalTypeStep({
  selectedType,
  theme,
  themeMode,
  copy,
  onSelectType,
  onCancel,
}: Props) {
  const creationCopy = copy.plan.creation;
  const categoriesCopy = creationCopy.categories;
  const goalTypesCopy = creationCopy.goalTypes;

  const [activeCategory, setActiveCategory] = useState<
    AthleteGoalCategory | "all"
  >(GOAL_TYPE_CATEGORY[selectedType] || "all");

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
            label={creationCopy.categoriesAll}
            selected={activeCategory === "all"}
            theme={theme}
            themeMode={themeMode}
            onPress={() => setActiveCategory("all")}
          />
          {ATHLETE_GOAL_CATEGORIES.map((cat) => (
            <OptionChip
              key={cat}
              label={categoriesCopy[cat as keyof typeof categoriesCopy] ?? cat}
              selected={activeCategory === cat}
              theme={theme}
              themeMode={themeMode}
              onPress={() => setActiveCategory(cat)}
            />
          ))}
        </ScrollView>
      </SheetBlock>

      {/* Goal types list */}
      <SheetBlock theme={theme}>
        <View style={styles.typesList}>
          {filteredTypes.map((goalType) => {
            const title =
              goalTypesCopy[goalType as keyof typeof goalTypesCopy] ?? goalType;

            return (
              <GoalTypeCard
                key={goalType}
                goalType={goalType}
                title={title}
                theme={theme}
                themeMode={themeMode}
                onPress={() => onSelectType(goalType)}
              />
            );
          })}
        </View>
      </SheetBlock>

      {/* Cancel button at the bottom of the list */}
      <SheetBlock theme={theme}>
        <SheetButton
          label={creationCopy.common.cancel}
          onPress={onCancel}
          variant="secondary"
          theme={theme}
          themeMode={themeMode}
        />
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
    gap: 6,
  },
});
