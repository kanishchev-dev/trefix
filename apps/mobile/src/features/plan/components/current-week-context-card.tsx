import { StyleSheet, Text, View } from "react-native";
import { Zap } from "lucide-react-native";

import { type CurrentWeekContext } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { Card } from "../../../shared/ui/card";
import {
  keySessionLabel,
  phaseIntent,
  phaseTitle,
} from "../../plans/lib/plan-texts";

type Props = {
  context: CurrentWeekContext;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

export function CurrentWeekContextCard({ context, theme, copy }: Props) {
  const planCopy = copy.plan;
  const description = phaseIntent(context.phase, copy);
  const focusItems = context.keySessions.map((session) =>
    keySessionLabel(session, copy),
  );

  return (
    <Card variant="glass" theme={theme} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Zap color={theme.color.accent} size={16} />
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {planCopy.currentWeekContext.sectionTitle}
          </Text>
        </View>

        <Text
          style={[
            styles.contextTitle,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {phaseTitle(context.phase, copy)}
        </Text>
      </View>

      {description ? (
        <Text
          style={[
            styles.descriptionText,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {description}
        </Text>
      ) : null}

      {focusItems.length > 0 ? (
        <View style={styles.bulletsSection}>
          {focusItems.map((item, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <View
                style={[
                  styles.bulletDot,
                  { backgroundColor: theme.color.accent },
                ]}
              />
              <Text
                style={[
                  styles.bulletText,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  contextTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bulletsSection: {
    gap: 8,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
