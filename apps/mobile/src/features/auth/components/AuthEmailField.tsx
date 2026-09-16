import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { GlassView } from "expo-glass-effect";

import { mobileAuthEmailRequestSchema } from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
  onSubmit?: (email: string) => void;
};

export function AuthEmailField({ theme, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const normalizedEmail = email.trim();
  const isValidEmail = useMemo(
    () => mobileAuthEmailRequestSchema.safeParse({ email: normalizedEmail }).success,
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
          borderColor: theme.color.glassBorder,
          backgroundColor: theme.color.glassBackground,
        },
      ]}
    >
      <TextInput
        accessibilityLabel="Электронная почта"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? "" : "Электронная почта"}
        placeholderTextColor={theme.color.mutedForeground}
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
        value={email}
      />

      {showAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Продолжить"
          disabled={!isValidEmail}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: isValidEmail ? theme.color.foreground : theme.color.glassBorder,
            },
            pressed && isValidEmail && styles.submitButtonPressed,
            !isValidEmail && styles.submitButtonDisabled,
          ]}
        >
          <View style={styles.arrowWrap}>
            <View
              style={[
                styles.chevron,
                {
                  borderTopColor: isValidEmail ? theme.color.background : theme.color.mutedForeground,
                  borderRightColor: isValidEmail ? theme.color.background : theme.color.mutedForeground,
                },
              ]}
            />
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
    ...StyleSheet.absoluteFillObject,
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
    borderRadius: 12,
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
