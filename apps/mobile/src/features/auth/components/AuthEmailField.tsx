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
        placeholder="Электронная почта"
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
        textAlign="center"
        textAlignVertical="center"
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
                styles.arrowLine,
                { backgroundColor: isValidEmail ? theme.color.background : theme.color.mutedForeground },
              ]}
            />
            <View
              style={[
                styles.arrowHeadTop,
                {
                  borderTopColor: isValidEmail ? theme.color.background : theme.color.mutedForeground,
                  borderRightColor: isValidEmail ? theme.color.background : theme.color.mutedForeground,
                },
              ]}
            />
            <View
              style={[
                styles.arrowHeadBottom,
                {
                  borderBottomColor: isValidEmail ? theme.color.background : theme.color.mutedForeground,
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
    lineHeight: 22,
    paddingHorizontal: 18,
    paddingVertical: 0,
  },
  submitButton: {
    position: "absolute",
    right: 10,
    top: 11,
    width: 34,
    height: 34,
    borderRadius: 17,
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
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowLine: {
    position: "absolute",
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  arrowHeadTop: {
    position: "absolute",
    right: 1,
    top: 2,
    width: 7,
    height: 7,
    borderTopWidth: 2,
    borderRightWidth: 2,
    transform: [{ rotate: "45deg" }],
  },
  arrowHeadBottom: {
    position: "absolute",
    right: 1,
    bottom: 2,
    width: 7,
    height: 7,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    transform: [{ rotate: "-45deg" }],
  },
});
