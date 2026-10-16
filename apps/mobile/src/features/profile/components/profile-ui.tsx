import { Fragment, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Check, ChevronRight } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

export const ROW_ICON = 20;
export const HEADER_ICON = 22;
export const ICON_STROKE = 1.9;

/**
 * Card with a tappable header (icon, title, chevron) over a summary body:
 * the main profile screen and the running profile hub are built from these.
 */
export function ProfileCard({
  theme,
  title,
  icon,
  onPress,
  children,
  accessibilityLabel,
}: {
  theme: ThemeTokens;
  title: string;
  icon?: ReactNode;
  onPress?: () => void;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
      >
        {icon}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            styles.cardTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
        {onPress ? (
          <ChevronRight
            color={theme.color.mutedForeground}
            size={18}
            strokeWidth={2.2}
          />
        ) : null}
      </Pressable>
      {children ? (
        <>
          <View
            style={[styles.rule, { backgroundColor: theme.color.screen }]}
          />
          {children}
        </>
      ) : null}
    </View>
  );
}

/** Padded block inside a card. */
export function CardBody({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.body, style]}>{children}</View>;
}

export type Stat = {
  value: string;
  /** Muted unit right after the value: "км", "года". */
  unit?: string;
  label: string;
  /** Element after the value, e.g. the Strava source badge. */
  badge?: ReactNode;
};

/** Values in equal columns split by lines in the page background colour. */
export function StatGrid({
  theme,
  stats,
  style,
  compact = false,
}: {
  theme: ThemeTokens;
  stats: Stat[];
  style?: StyleProp<ViewStyle>;
  /** Four columns inside a padded body. */
  compact?: boolean;
}) {
  return (
    <View style={[compact ? styles.statsCompact : styles.stats, style]}>
      {stats.map((stat, index) => (
        <View
          key={stat.label}
          style={[
            styles.stat,
            compact && styles.statCompact,
            index > 0 && {
              borderLeftWidth: 1,
              borderLeftColor: theme.color.screen,
            },
          ]}
        >
          <View style={styles.statValueRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.statValue,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {stat.value}
              {stat.unit ? (
                <Text
                  style={[
                    styles.statUnit,
                    { color: theme.color.mutedForeground },
                  ]}
                >
                  {` ${stat.unit}`}
                </Text>
              ) : null}
            </Text>
            {stat.badge}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.statLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export type Circle = {
  key: string;
  label: string;
  /** `off` — not available (dimmed, not tappable). */
  state: "on" | "idle" | "off";
};

/** Row of round toggles: training days, workouts per week. */
export function CircleRow({
  theme,
  items,
  onPress,
  idleColor,
}: {
  theme: ThemeTokens;
  items: Circle[];
  onPress?: (key: string) => void;
  /** Background of an unselected circle; the page colour inside cards, the card colour on the page. */
  idleColor?: string;
}) {
  return (
    <View style={styles.circles}>
      {items.map((item) => {
        const on = item.state === "on";
        const circle = (
          <View
            style={[
              styles.circle,
              {
                backgroundColor: on
                  ? theme.color.primary
                  : (idleColor ?? theme.color.screen),
              },
              item.state === "off" && styles.circleOff,
            ]}
          >
            <Text
              style={[
                styles.circleText,
                {
                  color: on
                    ? theme.color.primaryForeground
                    : theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {item.label}
            </Text>
          </View>
        );
        if (!onPress) return <Fragment key={item.key}>{circle}</Fragment>;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: item.state === "off" }}
            accessibilityLabel={item.label}
            disabled={item.state === "off"}
            onPress={() => onPress(item.key)}
            hitSlop={4}
          >
            {circle}
          </Pressable>
        );
      })}
    </View>
  );
}

export function zoneColors(theme: ThemeTokens): string[] {
  const c = theme.color;
  return [c.zone1, c.zone2, c.zone3, c.zone4, c.zone5];
}

/** Five zone bars with "Z1 –131" captions. */
export function ZoneStrip({
  theme,
  labels,
}: {
  theme: ThemeTokens;
  /** Range text per zone, Z1 first. */
  labels: string[];
}) {
  const colors = zoneColors(theme);
  return (
    <View style={styles.zones}>
      {labels.map((label, index) => (
        <View key={index} style={styles.zone}>
          <View style={[styles.zoneBar, { backgroundColor: colors[index] }]} />
          <Text
            numberOfLines={1}
            style={[
              styles.zoneLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            <Text
              style={{
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              }}
            >
              {`Z${index + 1}`}
            </Text>
            {` ${label}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Share of a resource used, 0–100. */
export function WearBar({
  theme,
  percent,
}: {
  theme: ThemeTokens;
  percent: number;
}) {
  return (
    <View style={[styles.track, { backgroundColor: theme.color.screen }]}>
      <View
        style={[
          styles.bar,
          {
            width: `${Math.max(0, Math.min(100, percent))}%`,
            backgroundColor: theme.color.foreground,
          },
        ]}
      />
    </View>
  );
}

export function KeyValue({
  theme,
  label,
  value,
}: {
  theme: ThemeTokens;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.keyValue}>
      <Text
        numberOfLines={1}
        style={[
          styles.kvText,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.kvText,
          styles.kvValue,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Muted one-line or wrapped text inside a card body. */
export function Meta({
  theme,
  text,
  numberOfLines = 1,
}: {
  theme: ThemeTokens;
  text: string;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.meta,
        {
          color: theme.color.mutedForeground,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      {text}
    </Text>
  );
}

/** Check mark of the selected option in a radio list. */
export function SelectedMark({ theme }: { theme: ThemeTokens }) {
  return <Check color={theme.color.foreground} size={18} strokeWidth={2.4} />;
}

/** Medium-weight text, used as the title line inside card bodies. */
export function BodyTitle({
  theme,
  text,
  style,
}: {
  theme: ThemeTokens;
  text: string;
  style?: object;
}) {
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.bodyTitle,
        {
          color: theme.color.foreground,
          fontFamily: theme.typography.fontFamily.sans.medium,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
  },
  cardHeader: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  rule: {
    height: 1,
    marginHorizontal: 16,
  },
  pressed: {
    opacity: 0.82,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  stats: {
    flexDirection: "row",
    paddingTop: 14,
    paddingBottom: 16,
  },
  statsCompact: {
    flexDirection: "row",
    paddingTop: 4,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
  },
  statCompact: {
    paddingHorizontal: 4,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 22,
  },
  statUnit: {
    fontSize: 13,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  circles: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  circleOff: {
    opacity: 0.35,
  },
  circleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  zones: {
    flexDirection: "row",
    gap: 4,
  },
  zone: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  zoneBar: {
    height: 8,
    borderRadius: 4,
  },
  zoneLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 3,
  },
  keyValue: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kvText: {
    fontSize: 15,
    lineHeight: 20,
  },
  kvValue: {
    flexShrink: 1,
    textAlign: "right",
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  bodyTitle: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
});
