import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  type ReactNode,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ChevronRight } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

/** Group title above a card: sentence case, 12px medium, foreground at 70%. */
export function SectionTitle({
  text,
  theme,
}: {
  text: string;
  theme: ThemeTokens;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.sectionTitle,
        {
          color: theme.color.foreground,
          fontFamily: theme.typography.fontFamily.sans.medium,
        },
      ]}
    >
      {text}
    </Text>
  );
}

/** Rows of a plain list sit flush with the page edge instead of the card padding. */
const PlainListContext = createContext(false);
/** Row icons drawn without the round surface (profile and settings). */
const BareIconsContext = createContext(false);

/**
 * Rows separated by lines in the page background colour: on a card, or
 * `plain` — straight on the page, flush with the section title. `bare` drops
 * the round surface behind row icons and runs the lines edge to edge.
 */
export function ListCard({
  theme,
  children,
  style,
  plain = false,
  bare = false,
}: {
  theme: ThemeTokens;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  plain?: boolean;
  bare?: boolean;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <BareIconsContext.Provider value={bare}>
      <PlainListContext.Provider value={plain}>
        <View
          style={[
            plain ? null : [styles.card, { backgroundColor: theme.color.card }],
            style,
          ]}
        >
          {rows.map((row, index) => (
            <Fragment key={row.key ?? index}>
              {index > 0 ? (
                <View
                  style={[
                    styles.separator,
                    (plain || bare) && styles.separatorPlain,
                    { backgroundColor: theme.color.screen },
                  ]}
                />
              ) : null}
              {row}
            </Fragment>
          ))}
        </View>
      </PlainListContext.Provider>
    </BareIconsContext.Provider>
  );
}

/** Icon in a soft circle, used by rows and tiles. */
export function IconCircle({
  theme,
  children,
  size = 42,
}: {
  theme: ThemeTokens;
  children: ReactNode;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.iconCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.color.iconSurface,
        },
      ]}
    >
      {children}
    </View>
  );
}

type ListRowProps = {
  theme: ThemeTokens;
  title: string;
  /** One line only; long text is truncated. */
  description?: string;
  icon?: ReactNode;
  /** Value on the right, before the chevron. */
  value?: string;
  /** Colour of the value, e.g. `warning` for "not set". */
  valueColor?: string;
  /** Extra element on the right (badge, switch). */
  trailing?: ReactNode;
  /** Marks a group with missing values. */
  dot?: boolean;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListRow({
  theme,
  title,
  description,
  icon,
  value,
  valueColor,
  trailing,
  dot = false,
  chevron,
  destructive = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const plain = useContext(PlainListContext);
  const bare = useContext(BareIconsContext);
  const showChevron = chevron ?? Boolean(onPress);
  const titleColor = destructive ? theme.color.danger : theme.color.foreground;
  const content = (
    <View style={[styles.rowContent, bare && styles.rowContentBare]}>
      {icon ? (
        bare ? (
          icon
        ) : (
          <IconCircle theme={theme}>{icon}</IconCircle>
        )
      ) : null}
      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          style={[
            styles.rowTitle,
            {
              color: titleColor,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            numberOfLines={1}
            style={[
              styles.rowDescription,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          numberOfLines={1}
          style={[
            styles.rowValue,
            {
              color: valueColor ?? theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {value}
        </Text>
      ) : null}
      {dot ? (
        <View style={[styles.dot, { backgroundColor: theme.color.warning }]} />
      ) : null}
      {trailing}
      {showChevron ? (
        <ChevronRight
          color={theme.color.mutedForeground}
          size={18}
          strokeWidth={2.2}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.row, bare && styles.rowBare, plain && styles.rowPlain]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        [title, value, description].filter(Boolean).join(", ")
      }
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        bare && styles.rowBare,
        plain && styles.rowPlain,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Tappable tile inside a sheet, like the plan creation method cards. */
export function ActionCard({
  theme,
  title,
  description,
  icon,
  trailing,
  onPress,
  disabled = false,
}: {
  theme: ThemeTokens;
  title: string;
  description?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        { backgroundColor: theme.color.control },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon ? (
        <IconCircle theme={theme} size={44}>
          {icon}
        </IconCircle>
      ) : null}
      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          style={[
            styles.rowTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            numberOfLines={1}
            style={[
              styles.rowDescription,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

/** Round mark next to a value that came from an external source: "S" — Strava, "H" — Apple Health / Health Connect. */
export function SourceBadge({
  theme,
  label = "S",
}: {
  theme: ThemeTokens;
  label?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: theme.color.iconSurface }]}>
      <Text
        style={[
          styles.badgeText,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** Small pill for statuses ("Вкл.", "Скоро замена"). */
export function Pill({
  theme,
  text,
  tone = "neutral",
}: {
  theme: ThemeTokens;
  text: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <View style={[styles.pill, { backgroundColor: theme.color.iconSurface }]}>
      <Text
        numberOfLines={1}
        style={[
          styles.pillText,
          {
            color:
              tone === "warning" ? theme.color.warning : theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.7,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
  },
  separatorPlain: {
    marginLeft: 0,
  },
  rowPlain: {
    paddingHorizontal: 0,
  },
  separator: {
    height: 1,
    marginLeft: 70,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowContentBare: {
    gap: 14,
  },
  rowBare: {
    minHeight: 52,
    paddingHorizontal: 16,
  },
  iconCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
    maxWidth: "50%",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 24,
  },
  badge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 11,
  },
  pill: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
