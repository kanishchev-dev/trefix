import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import type { ThemeTokens } from "@workspace/tokens";
import type { ProgressMilestone } from "../types/progress-types";
import type { MainCopy } from "../../../locales";
import { MilestoneCard } from "./milestone-card";

type Props = {
  milestones: ProgressMilestone[];
  visible: boolean;
  onClose: () => void;
  onSelectMilestone: (milestone: ProgressMilestone) => void;
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function MilestonesListSheet({
  milestones,
  visible,
  onClose,
  onSelectMilestone,
  theme,
  themeMode,
  copy,
}: Props) {
  const isDark = themeMode === "dark";

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={styles.backdrop} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
            },
          ]}
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: isDark
                    ? "rgba(255, 255, 255, 0.2)"
                    : "rgba(0, 0, 0, 0.15)",
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={20} color={theme.color.foreground} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.headerArea}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.extrabold,
                },
              ]}
            >
              {copy.progress?.milestones?.allTitle || "All Milestones"}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  topBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 3,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    top: 10,
    padding: 4,
  },
  headerArea: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 28,
  },
  listContent: {
    paddingHorizontal: 16,
  },
});
