import { Pressable, StyleSheet, Text, View } from "react-native";
import { MoreHorizontal } from "lucide-react-native";

import { type PlanListItem } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { Card } from "../../../shared/ui/card";
import { planCardStatus, planCardSubtitle } from "../lib/plan-card-format";
import { ProgressBar } from "./plans-ui";

type Props = {
  plan: PlanListItem;
  onPress: () => void;
  /** Opens the card actions; also bound to long-press. */
  onOpenActions?: () => void;
  /** Compact variant for the Plan tab empty state. */
  compact?: boolean;
  highlighted?: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

export function PlanCard({
  plan,
  onPress,
  onOpenActions,
  compact = false,
  highlighted = false,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const plansCopy = copy.plans;
  const status = planCardStatus(plan, copy, language);
  const subtitle = planCardSubtitle(plan, copy, language);
  const isActive = plan.status === "active";
  const regular = theme.typography.fontFamily.sans.regular;
  const medium = theme.typography.fontFamily.sans.medium;

  return (
    <Card
      size="sm"
      theme={theme}
      themeMode={themeMode}
      style={[
        styles.card,
        highlighted && { borderColor: theme.color.primary, borderWidth: 1.5 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fillTemplate(plansCopy.card.a11y, {
          name: plan.name,
          status,
        })}
        onPress={onPress}
        onLongPress={onOpenActions}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        <View style={styles.titleRow}>
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
            {plan.name}
          </Text>
          {plan.creationSource === "ai" ? (
            <Badge label={plansCopy.badge.ai} theme={theme} />
          ) : null}
          {isActive ? (
            <Badge label={`● ${plansCopy.badge.active}`} theme={theme} strong />
          ) : null}
        </View>

        {!compact || !isActive ? (
          <Text
            numberOfLines={1}
            style={[
              styles.meta,
              { color: theme.color.mutedForeground, fontFamily: regular },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}

        <Text
          style={[
            styles.status,
            { color: theme.color.foreground, fontFamily: medium },
          ]}
        >
          {status}
        </Text>

        {isActive && plan.progress !== undefined ? (
          <ProgressBar
            value={plan.progress}
            accessibilityLabel={fillTemplate(plansCopy.card.progressA11y, {
              percent: Math.round(plan.progress * 100),
            })}
            theme={theme}
          />
        ) : null}

        {!compact && plan.notesPreview ? (
          <Text
            numberOfLines={1}
            style={[
              styles.notes,
              { color: theme.color.mutedForeground, fontFamily: regular },
            ]}
          >
            {`«${plan.notesPreview.split("\n")[0]}»`}
          </Text>
        ) : null}

        {plan.metricsStale ? (
          <Text
            style={[
              styles.stale,
              { color: theme.color.danger, fontFamily: medium },
            ]}
          >
            {plansCopy.badge.stale}
          </Text>
        ) : null}
      </Pressable>

      {onOpenActions ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${plansCopy.card.moreActions}: ${plan.name}`}
          hitSlop={10}
          onPress={onOpenActions}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <MoreHorizontal color={theme.color.mutedForeground} size={20} />
        </Pressable>
      ) : null}
    </Card>
  );
}

function Badge({
  label,
  theme,
  strong = false,
}: {
  label: string;
  theme: ThemeTokens;
  strong?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: strong ? theme.color.primary : theme.color.secondary,
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: strong
              ? theme.color.primaryForeground
              : theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 0,
  },
  pressable: {
    gap: 6,
    padding: 18,
    paddingRight: 48,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
  },
  notes: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
  },
  stale: {
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 15,
  },
  more: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
