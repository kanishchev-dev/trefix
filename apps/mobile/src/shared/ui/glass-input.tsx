import { useState, type ReactNode } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  type TextInputProps,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import { type ThemeTokens } from "@workspace/tokens";

interface GlassInputProps extends TextInputProps {
  theme: ThemeTokens;
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function GlassInput({
  theme,
  label,
  error,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  ...props
}: GlassInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? (
        <Text
          style={[
            styles.label,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <GlassView
        glassEffectStyle="regular"
        tintColor={theme.color.glassTint}
        style={[
          styles.inputWrapper,
          {
            borderColor: error
              ? theme.color.danger
              : isFocused
              ? theme.color.foreground
              : theme.color.glassBorder,
            backgroundColor: theme.color.glassBackground,
          },
        ]}
      >
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}

        <TextInput
          style={[
            styles.input,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
              // If text is centered, we need symmetric padding to keep it in the middle
              paddingLeft: props.textAlign === "center" ? 44 : (leftIcon ? 44 : 16),
              paddingRight: props.textAlign === "center" ? 44 : (rightIcon ? 44 : 16),
              height: 56, // Ensure explicit height for alignment
            },
            style,
          ]}
          placeholderTextColor={theme.color.mutedForeground}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />

        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </GlassView>

      {error ? (
        <Text
          style={[
            styles.errorText,
            { color: theme.color.danger, fontFamily: theme.typography.fontFamily.sans.regular },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    width: "100%",
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 4,
  },
  inputWrapper: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
  input: {
    height: "100%",
    fontSize: 16,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  iconLeft: {
    position: "absolute",
    left: 14,
    zIndex: 1,
  },
  iconRight: {
    position: "absolute",
    right: 14,
    zIndex: 1,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 4,
  },
});
