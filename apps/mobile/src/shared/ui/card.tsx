import * as React from "react";
import { StyleSheet, Text, View, type ViewProps, type TextProps } from "react-native";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";

export type CardProps = ViewProps & {
  theme?: ThemeTokens;
  themeMode?: ThemeMode;
  size?: "default" | "sm";
  variant?: "default" | "glass";
};

export function Card({ style, size = "default", variant = "default", theme, themeMode, children, ...props }: CardProps) {
  const isDark = themeMode === "dark" || theme?.color.background === "#09090b" || theme?.color.surface === "#111111";

  // Deep dark charcoal surface matching the clean design
  const cardBg = theme?.color.card ?? "#ffffff";
  const borderColor = theme?.color.cardBorder ?? "rgba(0, 0, 0, 0.08)";

  return (
    <View
      style={[
        styles.card,
        size === "sm" && styles.cardSm,
        {
          backgroundColor: cardBg,
          borderColor: borderColor,
          borderWidth: StyleSheet.hairlineWidth,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardHeader({ style, ...props }: ViewProps) {
  return <View style={[styles.header, style]} {...props} />;
}

export function CardTitle({ style, children, ...props }: TextProps) {
  return (
    <Text style={[styles.title, style]} {...props}>
      {children}
    </Text>
  );
}

export function CardDescription({ style, children, ...props }: TextProps) {
  return (
    <Text style={[styles.description, style]} {...props}>
      {children}
    </Text>
  );
}

export function CardAction({ style, ...props }: ViewProps) {
  return <View style={[styles.action, style]} {...props} />;
}

export function CardContent({ style, ...props }: ViewProps) {
  return <View style={[styles.content, style]} {...props} />;
}

export function CardFooter({ style, ...props }: ViewProps) {
  return <View style={[styles.footer, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16,
    overflow: "hidden",
  },
  cardSm: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  content: {
    gap: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
