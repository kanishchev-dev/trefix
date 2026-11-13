import { Text, View } from "react-native";
import { type ThemeTokens } from "@trefix/tokens";
import { styles } from "./plan-creation-ui.styles";

export function FieldError({
  message,
  theme,
}: {
  message: string;
  theme: ThemeTokens;
}) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.fieldError,
        {
          color: theme.color.danger,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      {message}
    </Text>
  );
}

/** Centred field label with an optional short description in small muted text under it. */
export function InputRowHeader({
  label,
  info,
  badge,
  theme,
}: {
  label: string;
  info?: string;
  badge?: string;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.fieldHeader}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>
        {badge ? (
          <View
            style={[
              styles.badgePill,
              { backgroundColor: theme.color.surfaceElevated },
            ]}
          >
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {info ? (
        <Text
          style={[
            styles.fieldInfo,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {info}
        </Text>
      ) : null}
    </View>
  );
}
