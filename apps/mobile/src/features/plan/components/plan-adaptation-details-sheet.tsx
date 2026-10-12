import { Pressable, StyleSheet, Text, View } from "react-native";
import { Clock, Sparkles } from "lucide-react-native";

import { type PlanAdaptation } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetSectionLabel,
} from "../../../shared/ui/bottom-sheet";

type Props = {
  adaptation: PlanAdaptation | null;
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/**
 * Adaptation details rendered in the canonical app-wide bottom sheet
 * (shared BottomSheet shell extracted from the workout goal sheet).
 */
export function PlanAdaptationDetailsSheet({
  adaptation,
  visible,
  onClose,
  theme,
  themeMode,
  copy,
}: Props) {
  if (!adaptation) {
    return (
      <BottomSheet
        visible={false}
        onClose={onClose}
        theme={theme}
        themeMode={themeMode}
      />
    );
  }

  const planCopy = copy.plan;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
      renderHeader={() => (
        <View style={styles.titleRow}>
          <Sparkles color={theme.color.accent} size={20} />
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {adaptation.title}
          </Text>
        </View>
      )}
    >
      {/* What Changed / Description */}
      {adaptation.description ? (
        <View style={styles.section}>
          <SheetSectionLabel
            text={planCopy.adaptationDetails.whatChanged.toUpperCase()}
            theme={theme}
          />
          <Text
            style={[
              styles.bodyText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {adaptation.description}
          </Text>
        </View>
      ) : null}

      {/* Meta Row: Affected Week & Timestamp */}
      <View style={styles.metaSection}>
        {adaptation.weekNumber ? (
          <View
            style={[
              styles.metaBox,
              {
                backgroundColor: theme.color.surface,
                borderColor: theme.color.border,
              },
            ]}
          >
            <Text
              style={[
                styles.metaLabel,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {planCopy.adaptationDetails.affectedWeek}
            </Text>
            <Text
              style={[
                styles.metaValue,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {planCopy.timeline.weekLabel.replace(
                "{{number}}",
                String(adaptation.weekNumber),
              )}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.metaBox,
            {
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
            },
          ]}
        >
          <Clock color={theme.color.mutedForeground} size={14} />
          <Text
            style={[
              styles.metaLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {adaptation.createdAt}
          </Text>
        </View>
      </View>

      {/* Close Button */}
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [
          styles.doneButton,
          { backgroundColor: theme.color.primary },
          pressed && styles.doneButtonPressed,
        ]}
      >
        <Text
          style={[
            styles.doneLabel,
            {
              color: theme.color.primaryForeground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {planCopy.adaptationDetails.close}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  section: {
    gap: 6,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaSection: {
    flexDirection: "row",
    gap: 12,
  },
  metaBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  doneButton: {
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  doneLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
});
