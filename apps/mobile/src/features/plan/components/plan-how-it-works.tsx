import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";

import { type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";

type Props = {
  theme: ThemeTokens;
  copy: MainCopy;
  language: AppLanguage;
};

const CARD_WIDTH = 250;
/** Sample week of the schedule preview: Tuesday, Thursday, Saturday, Sunday. */
const SAMPLE_DAYS = [false, true, false, true, false, true, true];
/** Sample load landscape: four weeks behind, the rest ahead. */
const SAMPLE_LOAD = [14, 16, 18, 13, 22, 23, 25, 17, 27, 28, 20, 12];
const SAMPLE_DONE = 4;

/**
 * Three steps of a plan with the coach as a swipeable strip. Each card opens
 * with a small preview of what the step gives: the goal, the week, the plan.
 */
export function PlanHowItWorks({ theme, copy, language }: Props) {
  const t = copy.plan.screen.empty;
  const dayNames = shortDayNamesFor(language);
  const medium = theme.typography.fontFamily.sans.medium;
  const regular = theme.typography.fontFamily.sans.regular;
  const fg = theme.color.foreground;
  const muted = theme.color.mutedForeground;

  const previews = [
    <View key="goal" style={styles.fill}>
      <Svg
        width={88}
        height={88}
        viewBox="0 0 88 88"
        style={styles.goalRings}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[42, 30, 18].map((radius) => (
          <Circle
            key={radius}
            cx={44}
            cy={44}
            r={radius}
            fill="none"
            stroke={fg}
            strokeWidth={1.2}
            opacity={0.5}
          />
        ))}
        <Circle cx={44} cy={44} r={5} fill={fg} opacity={0.5} />
      </Svg>
      <View style={styles.goalText}>
        <Text
          style={[styles.previewKicker, { color: muted, fontFamily: medium }]}
        >
          {t.previewRace}
        </Text>
        <Text style={[styles.previewValue, { color: fg, fontFamily: medium }]}>
          {t.previewTime}
        </Text>
        <Text
          style={[styles.previewSub, { color: muted, fontFamily: regular }]}
        >
          {t.previewDistance}
        </Text>
      </View>
    </View>,
    <View key="days" style={styles.days}>
      {SAMPLE_DAYS.map((on, index) => (
        <View key={index} style={styles.day}>
          <View
            style={[
              styles.dayPill,
              {
                backgroundColor: on
                  ? theme.color.primary
                  : theme.color.separator,
              },
            ]}
          />
          <Text
            style={[
              styles.dayName,
              { color: on ? fg : muted, fontFamily: on ? medium : regular },
            ]}
          >
            {dayNames[index]}
          </Text>
        </View>
      ))}
    </View>,
    <View key="plan" style={styles.fill}>
      <View style={[styles.badge, { backgroundColor: theme.color.aiSurface }]}>
        <Sparkles size={12} color={theme.color.ai} />
        <Text
          style={[
            styles.badgeText,
            { color: theme.color.ai, fontFamily: medium },
          ]}
        >
          {t.coachBadge}
        </Text>
      </View>
      <View style={styles.bars}>
        {SAMPLE_LOAD.map((height, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: fg,
                opacity: index < SAMPLE_DONE ? 0.85 : 0.3,
              },
            ]}
          />
        ))}
      </View>
    </View>,
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: fg, fontFamily: medium }]}>
          {t.howTitle}
        </Text>
        <Text style={[styles.count, { color: muted, fontFamily: regular }]}>
          {t.howCount}
        </Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 10}
        contentContainerStyle={styles.strip}
      >
        {t.steps.map((step, index) => (
          <View
            key={step.title}
            accessible
            accessibilityLabel={`${fillTemplate(t.step, { number: index + 1 })}. ${step.title}. ${step.description}`}
            style={[styles.card, { backgroundColor: theme.color.card }]}
          >
            <View
              style={[
                styles.preview,
                { backgroundColor: theme.color.secondary },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {previews[index]}
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.step, { color: muted, fontFamily: medium }]}>
                {fillTemplate(t.step, { number: index + 1 })}
              </Text>
              <Text
                style={[styles.stepTitle, { color: fg, fontFamily: medium }]}
              >
                {step.title}
              </Text>
              <Text
                style={[styles.stepText, { color: muted, fontFamily: regular }]}
              >
                {step.description}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  count: {
    fontSize: 13,
    lineHeight: 18,
  },
  strip: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 24,
    padding: 10,
    paddingBottom: 16,
    gap: 12,
  },
  preview: {
    height: 118,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  goalRings: {
    position: "absolute",
    right: -10,
    bottom: -14,
  },
  goalText: {
    position: "absolute",
    left: 14,
    top: 14,
  },
  previewKicker: {
    fontSize: 11,
    lineHeight: 14,
  },
  previewValue: {
    marginTop: 4,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  previewSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  days: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  day: {
    alignItems: "center",
    gap: 6,
  },
  dayPill: {
    width: 20,
    height: 44,
    borderRadius: 10,
  },
  dayName: {
    fontSize: 10,
    lineHeight: 12,
  },
  badge: {
    position: "absolute",
    left: 12,
    top: 12,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
  bars: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    height: 28,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    transform: [{ skewX: "-24deg" }],
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  cardText: {
    paddingHorizontal: 6,
    gap: 4,
  },
  step: {
    fontSize: 12,
    lineHeight: 16,
  },
  stepTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
