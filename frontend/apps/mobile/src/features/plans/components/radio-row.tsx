import { Pressable, Text, View } from "react-native";
import { type ThemeTokens } from "@trefix/tokens";
import { plansUiStyles } from "./plans-ui";
import { styles } from "./start-plan-sheet.styles";

export function RadioRow({
  label,
  meta,
  badge,
  selected,
  disabled = false,
  accessibilityHint,
  onPress,
  theme,
}: {
  label: string;
  meta?: string;
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={[label, meta, badge].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioRow,
        { backgroundColor: theme.color.control, opacity: disabled ? 0.5 : 1 },
        pressed && plansUiStyles.pressed,
      ]}
    >
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? theme.color.primary : theme.color.border },
        ]}
      >
        {selected ? (
          <View
            style={[
              styles.radioInner,
              { backgroundColor: theme.color.primary },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.radioText}>
        <Text
          style={[
            styles.radioLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {label}
        </Text>
        {meta ? (
          <Text
            style={[
              styles.muted,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <Text
          style={[
            styles.badge,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {badge}
        </Text>
      ) : null}
    </Pressable>
  );
}
