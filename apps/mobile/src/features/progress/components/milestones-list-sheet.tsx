import { ScrollView, StyleSheet } from "react-native";
import type { ThemeMode, ThemeTokens } from "@workspace/tokens";
import type { ProgressMilestone } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { MilestoneCard } from "./milestone-card";
import { BottomSheet } from "../../../shared/ui/bottom-sheet";

type Props = {
  milestones: ProgressMilestone[];
  visible: boolean;
  onClose: () => void;
  onSelectMilestone: (milestone: ProgressMilestone) => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/**
 * All-milestones list rendered in the canonical app-wide bottom sheet
 * (shared BottomSheet shell extracted from the workout goal sheet).
 */
export function MilestonesListSheet({
  milestones,
  visible,
  onClose,
  onSelectMilestone,
  theme,
  themeMode,
  copy,
}: Props) {
  return (
    <BottomSheet
      title={copy.progress?.milestones?.allTitle || "All Milestones"}
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            copy={copy}
            milestone={m}
            onPress={() => {
              onClose();
              onSelectMilestone(m);
            }}
            theme={theme}
            themeMode={themeMode}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  listContent: {
    gap: 4,
    paddingVertical: 4,
  },
});
