import { forwardRef, useImperativeHandle, useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  theme: ThemeTokens;
};

export const OtpCodeField = forwardRef<TextInput, Props>(function OtpCodeField(
  { value, onChangeText, placeholder = "• • • • • •", accessibilityLabel = "Verification code", theme },
  ref,
) {
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => inputRef.current as TextInput, []);

  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const placeholders = placeholder.split(/\s+/).filter(Boolean);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.wrapper}>
      <View style={styles.row}>
        {digits.map((digit, index) => (
          <View
            key={`${index}-${digit}`}
            style={[
              styles.cell,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
              },
            ]}
          >
            <Text style={[styles.cellText, { color: theme.color.foreground }, digit.trim().length === 0 && { color: theme.color.mutedForeground }]}>
              {digit.trim().length === 0 ? placeholders[index] ?? "•" : digit}
            </Text>
          </View>
        ))}
      </View>

      <TextInput
        ref={inputRef}
        accessibilityLabel={accessibilityLabel}
        autoComplete="one-time-code"
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, "").slice(0, 6))}
        style={styles.hiddenInput}
        value={value}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  cell: {
    width: 40,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
  },
  cellText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
});
