import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, PenLine, Sparkles } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";

import { type PlanCounts, type PlanListItem } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { goalTitle, planTitle } from "../../plans/lib/plan-texts";
import { PlanHowItWorks } from "./plan-how-it-works";
import { PlanMethodArt } from "./plan-method-art";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  /** Library badges: drafts and history add their own blocks. */
  counts?: PlanCounts;
  /** Latest drafts (up to three) offered for a quick start. */
  drafts?: PlanListItem[];
  onCreateWithCoach: () => void;
  onCreateManually: () => void;
  onOpenPlans?: () => void;
  onOpenHistory?: () => void;
  onStartDraft?: (plan: PlanListItem) => void;
  onOpenDraft?: (plan: PlanListItem) => void;
};

/**
 * Plan tab without a plan in progress: an invitation, not an icon with text.
 * Two ways to build a plan, how it works with the coach, then the drafts.
 */
export function PlanEmptyState({
  theme,
  copy,
  language,
  counts,
  drafts = [],
  onCreateWithCoach,
  onCreateManually,
  onOpenPlans,
  onOpenHistory,
  onStartDraft,
  onOpenDraft,
}: Props) {
  const t = copy.plan.screen.empty;
  const dayNames = shortDayNamesFor(language);
  const medium = theme.typography.fontFamily.sans.medium;
  const regular = theme.typography.fontFamily.sans.regular;
  const fg = theme.color.foreground;
  const muted = theme.color.mutedForeground;
  const draftCount = counts?.draft ?? drafts.length;
  const hasHistory = (counts?.history ?? 0) > 0;
  const shownDrafts = drafts.slice(0, 3);

  const tiles = [
    {
      kind: "coach" as const,
      title: t.coachTitle,
      hint: t.coachHint,
      onPress: onCreateWithCoach,
      icon: <Sparkles size={20} color={theme.color.ai} />,
      iconBackground: theme.color.aiSurface,
    },
    {
      kind: "manual" as const,
      title: t.manualTitle,
      hint: t.manualHint,
      onPress: onCreateManually,
      icon: <PenLine size={20} color={theme.color.primary} />,
      iconBackground: theme.color.iconSurface,
    },
  ];

  const draftMeta = (draft: PlanListItem) =>
    [
      draft.name ? goalTitle(draft.goal, copy, language) : null,
      pluralize(t.weeksCount, draft.totalWeeks, language),
      draft.sessionsPerWeek
        ? fillTemplate(t.perWeek, { count: draft.sessionsPerWeek })
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <View style={styles.root}>
      <View style={styles.intro}>
        <View
          style={[styles.mark, { backgroundColor: theme.color.card }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={48} height={48} viewBox="0 0 24 24">
            {[10.2, 7, 3.8].map((radius) => (
              <Circle
                key={radius}
                cx={12}
                cy={12}
                r={radius}
                fill="none"
                stroke={fg}
                strokeWidth={1.2}
              />
            ))}
            <Circle cx={12} cy={12} r={1.3} fill={fg} />
          </Svg>
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: fg, fontFamily: medium }]}
        >
          {t.title}
        </Text>
        <Text
          style={[styles.description, { color: muted, fontFamily: regular }]}
        >
          {t.description}
        </Text>
      </View>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.kind}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}. ${tile.hint}`}
            onPress={tile.onPress}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: theme.color.card },
              pressed && styles.pressed,
            ]}
          >
            <PlanMethodArt kind={tile.kind} color={fg} dayNames={dayNames} />
            <View
              style={[
                styles.tileIcon,
                { backgroundColor: tile.iconBackground },
              ]}
            >
              {tile.icon}
            </View>
            <View>
              <Text
                style={[styles.tileTitle, { color: fg, fontFamily: medium }]}
              >
                {tile.title}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.tileHint, { color: muted, fontFamily: regular }]}
              >
                {tile.hint}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <PlanHowItWorks theme={theme} copy={copy} language={language} />

      {shownDrafts.length > 0 ? (
        <View style={styles.drafts}>
          <Text
            style={[styles.sectionTitle, { color: fg, fontFamily: medium }]}
          >
            {fillTemplate(t.drafts, { count: draftCount })}
          </Text>
          {shownDrafts.map((draft) => {
            const name = planTitle(draft, copy, language);
            const meta = draftMeta(draft);
            return (
              <Pressable
                key={draft.id}
                accessibilityRole="button"
                accessibilityLabel={`${name}. ${meta}`}
                disabled={!onOpenDraft}
                onPress={() => onOpenDraft?.(draft)}
                style={({ pressed }) => [
                  styles.draft,
                  { backgroundColor: theme.color.card },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.draftHead}>
                  <View style={styles.draftName}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.draftTitle,
                        { color: fg, fontFamily: medium },
                      ]}
                    >
                      {name}
                    </Text>
                    {draft.creationSource === "ai" ? (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: theme.color.aiSurface },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: theme.color.ai, fontFamily: medium },
                          ]}
                        >
                          {t.coachBadge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t.start}: ${name}`}
                    hitSlop={6}
                    onPress={() => onStartDraft?.(draft)}
                    style={({ pressed }) => [
                      styles.startButton,
                      { backgroundColor: theme.color.primary },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.startLabel,
                        {
                          color: theme.color.primaryForeground,
                          fontFamily: medium,
                        },
                      ]}
                    >
                      {t.start}
                    </Text>
                  </Pressable>
                </View>
                {meta ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.draftMeta,
                      { color: muted, fontFamily: regular },
                    ]}
                  >
                    {meta}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {hasHistory && draftCount === 0 && onOpenHistory ? (
        <LinkRow
          label={copy.plans.tab.prepareFromHistory}
          onPress={onOpenHistory}
          theme={theme}
        />
      ) : null}
      {(draftCount > 0 || hasHistory) && onOpenPlans ? (
        <LinkRow label={t.allPlans} onPress={onOpenPlans} theme={theme} />
      ) : null}
    </View>
  );
}

function LinkRow({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
    >
      <Text
        style={[
          styles.linkLabel,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {label}
      </Text>
      <ChevronRight size={18} color={theme.color.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  intro: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 24,
    gap: 8,
  },
  mark: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  description: {
    maxWidth: 300,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  tiles: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tile: {
    flex: 1,
    height: 150,
    borderRadius: 24,
    padding: 14,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  tileHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  drafts: {
    marginTop: 8,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  draft: {
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 6,
  },
  draftHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  draftName: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  draftTitle: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
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
  startButton: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  startLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  draftMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
});
