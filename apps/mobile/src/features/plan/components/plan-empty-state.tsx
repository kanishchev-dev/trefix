import { Pressable, StyleSheet, Text, View } from "react-native";
import { History, ListChecks, Target } from "lucide-react-native";

import { type PlanCounts, type PlanListItem } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { PlanCard } from "../../plans/components/plan-card";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onCreatePlan: () => void;
  /** Library badges; decide between the "drafts", "history" and empty variants. */
  counts?: PlanCounts;
  /** Latest drafts (up to three) offered for a quick start. */
  drafts?: PlanListItem[];
  onOpenPlans?: () => void;
  onOpenHistory?: () => void;
  onStartDraft?: (plan: PlanListItem) => void;
};

/** Plan tab without a plan in progress. */
export function PlanEmptyState({
  theme,
  themeMode,
  copy,
  language,
  onCreatePlan,
  counts,
  drafts = [],
  onOpenPlans,
  onOpenHistory,
  onStartDraft,
}: Props) {
  const emptyCopy = copy.plan.emptyState;
  const tabCopy = copy.plans.tab;
  const variant = counts && counts.draft > 0 ? "drafts" : counts && counts.history > 0 ? "history" : "empty";

  const title = variant === "drafts" ? tabCopy.noActiveTitle : variant === "history" ? tabCopy.historyTitle : emptyCopy.title;
  const description =
    variant === "drafts"
      ? tabCopy.noActiveDescription
      : variant === "history"
        ? tabCopy.historyDescription
        : emptyCopy.description;
  const Icon = variant === "drafts" ? ListChecks : variant === "history" ? History : Target;

  const primary =
    variant === "drafts"
      ? { label: tabCopy.openPlans, onPress: onOpenPlans }
      : variant === "history"
        ? { label: tabCopy.prepareFromHistory, onPress: onOpenHistory }
        : { label: emptyCopy.createButton, onPress: onCreatePlan };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: theme.color.border,
          },
        ]}
      >
        <Icon color={theme.color.accent} size={32} />
      </View>

      <View style={styles.textGroup}>
        <Text
          style={[
            styles.title,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.description,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {description}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          onPress={primary.onPress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.color.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              {
                color: theme.color.primaryForeground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {primary.label}
          </Text>
        </Pressable>

        {variant !== "empty" ? (
          <Pressable
            accessibilityRole="button"
            onPress={onCreatePlan}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.color.controlSecondary },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {tabCopy.createPlan}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {variant === "drafts" && drafts.length > 0 ? (
        <View style={styles.drafts}>
          {drafts.slice(0, 3).map((draft) => (
            <PlanCard
              key={draft.id}
              plan={draft}
              compact
              onPress={() => onStartDraft?.(draft)}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              language={language}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  textGroup: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 280,
  },
  buttons: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  button: {
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  drafts: {
    alignSelf: "stretch",
    gap: 12,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 20,
  },
});
