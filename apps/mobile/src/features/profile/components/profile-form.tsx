import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

/** Caption + filled input on the card colour, as in the edit forms of the profile. */
export function FormField({
  theme,
  label,
  children,
}: {
  theme: ThemeTokens;
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function FormInput({
  theme,
  style,
  ...props
}: TextInputProps & { theme: ThemeTokens }) {
  return (
    <TextInput
      placeholderTextColor={theme.color.mutedForeground}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: theme.color.card,
          color: theme.color.foreground,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
        style,
      ]}
    />
  );
}

/** Input-looking button that opens a sheet (date, list). */
export function FormSelect({
  theme,
  value,
  placeholder,
  icon,
  onPress,
  accessibilityLabel,
}: {
  theme: ThemeTokens;
  value: string | null;
  placeholder: string;
  icon?: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.input,
        styles.select,
        { backgroundColor: theme.color.card },
        pressed && styles.pressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.selectText,
          {
            color: value ? theme.color.foreground : theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {value ?? placeholder}
      </Text>
      {icon}
    </Pressable>
  );
}

/** Multi-line text on a card with a "92/300" counter. */
export function FormTextArea({
  theme,
  value,
  onChangeText,
  maxLength,
  placeholder,
  accessibilityLabel,
}: {
  theme: ThemeTokens;
  value: string;
  onChangeText: (value: string) => void;
  maxLength: number;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[styles.area, { backgroundColor: theme.color.card }]}>
      <TextInput
        multiline
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={theme.color.mutedForeground}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.areaInput,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      />
      <Text
        style={[
          styles.counter,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {`${value.length}/${maxLength}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  input: {
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.82,
  },
  area: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
    minHeight: 132,
  },
  areaInput: {
    flex: 1,
    minHeight: 88,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
    textAlignVertical: "top",
  },
  counter: {
    alignSelf: "flex-end",
    fontSize: 12,
    lineHeight: 16,
  },
});
