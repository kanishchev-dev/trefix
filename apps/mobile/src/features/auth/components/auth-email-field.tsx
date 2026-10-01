import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { GlassView } from "expo-glass-effect";

import { mobileAuthEmailRequestSchema } from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";
import { type AuthCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  copy: AuthCopy;
  value: string;
  isSubmitting?: boolean;
  onChangeText: (value: string) => void;
  onSubmit?: (email: string) => void;
};

export function AuthEmailField({
  theme,
  copy,
  value,
  isSubmitting = false,
  onChangeText,
  onSubmit,
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const normalizedEmail = value.trim();
  const isValidEmail = useMemo(
    () =>
      mobileAuthEmailRequestSchema.safeParse({ email: normalizedEmail })
        .success,
    [normalizedEmail],
  );
  const showAction = normalizedEmail.length > 0;

  function handleSubmit(): void {
    if (!isValidEmail) {
      return;
    }

    onSubmit?.(normalizedEmail);
  }

  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={theme.color.glassTint}
      style={[
        styles.root,
        {
          borderColor: isFocused
            ? theme.color.foreground
            : theme.color.glassBorder,
          backgroundColor: theme.color.glassBackground,
        },
      ]}
    >
      <TextInput
        accessibilityLabel={copy.email.accessibilityLabel}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!isSubmitting}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? "" : copy.email.placeholder}
        placeholderTextColor={theme.color.mutedForeground}
        onChangeText={onChangeText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        selectionColor={theme.color.foreground}
        spellCheck={false}
        style={[
          styles.input,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
        value={value}
      />

      {showAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.email.submitAccessibilityLabel}
          disabled={!isValidEmail || isSubmitting}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: isValidEmail
                ? theme.color.foreground
                : theme.color.glassBorder,
            },
            pressed &&
              isValidEmail &&
              !isSubmitting &&
              styles.submitButtonPressed,
            (!isValidEmail || isSubmitting) && styles.submitButtonDisabled,
          ]}
        >
          <View style={styles.arrowWrap}>
            {isSubmitting ? (
              <ActivityIndicator
                size="small"
                color={
                  isValidEmail
                    ? theme.color.background
                    : theme.color.mutedForeground
                }
              />
            ) : (
              <View
                style={[
                  styles.chevron,
                  {
                    borderTopColor: isValidEmail
                      ? theme.color.background
                      : theme.color.mutedForeground,
                    borderRightColor: isValidEmail
                      ? theme.color.background
                      : theme.color.mutedForeground,
                  },
                ]}
              />
            )}
          </View>
        </Pressable>
      ) : null}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
  input: {
    ...StyleSheet.absoluteFill,
    fontSize: 16,
    paddingHorizontal: 44,
    paddingVertical: 0,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  submitButton: {
    position: "absolute",
    right: 10,
    top: 11,
    width: 34,
    height: 34,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  arrowWrap: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 2,
    transform: [{ rotate: "45deg" }],
    marginLeft: -2,
  },
});
