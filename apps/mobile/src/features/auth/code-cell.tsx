import { Text, View } from "react-native";
import { GlassView } from "expo-glass-effect";
import { withAlpha, type ThemeTokens } from "@workspace/tokens";
import { glassBorderColor } from "./components/glass-border";
import { styles } from "./auth-verification-screen.styles";

export type HighlightState = "normal" | "error" | "success";

export type CodeCellProps = {
  theme: ThemeTokens;
  value: string;
  isActive: boolean;
  highlightState: HighlightState;
};

export function CodeCell({
  theme,
  value,
  isActive,
  highlightState,
}: CodeCellProps) {
  const borderColor =
    highlightState === "error"
      ? theme.color.dangerBorder
      : glassBorderColor(theme, isActive || highlightState === "success");

  const overlayColor =
    highlightState === "error"
      ? withAlpha(theme.color.danger, 0.08)
      : highlightState === "success"
        ? withAlpha(theme.color.foreground, 0.05)
        : "transparent";

  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={theme.color.glassTint}
      style={[
        styles.codeCell,
        {
          borderColor,
          backgroundColor:
            overlayColor !== "transparent"
              ? overlayColor
              : theme.color.glassBackground,
        },
        highlightState === "success" && { transform: [{ scale: 1.02 }] },
      ]}
    >
      {value ? (
        <Text
          style={[
            styles.codeDigit,
            {
              color:
                highlightState === "error"
                  ? theme.color.danger
                  : theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {value}
        </Text>
      ) : isActive && highlightState === "normal" ? (
        <View
          style={[
            styles.cursor,
            {
              backgroundColor: theme.color.foreground,
            },
          ]}
        />
      ) : null}
    </GlassView>
  );
}
