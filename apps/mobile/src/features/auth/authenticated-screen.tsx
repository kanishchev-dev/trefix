import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassView } from "expo-glass-effect";

import { type AuthTokens } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { type AuthCopy } from "../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: AuthCopy;
  session: AuthTokens;
  onLogout: () => void;
};

export function AuthenticatedScreen({
  theme,
  themeMode,
  copy,
  session,
  onLogout,
}: Props) {
  const logoSource =
    themeMode === "dark"
      ? require("../../../assets/trefix-logo-light.png")
      : require("../../../assets/trefix-logo-dark.png");

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: theme.color.foreground,
            opacity: themeMode === "dark" ? 0.06 : 0.04,
          },
        ]}
      />

      <View style={styles.content}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />

        <GlassView
          glassEffectStyle="regular"
          tintColor={theme.color.glassTint}
          style={[
            styles.card,
            {
              borderColor: theme.color.glassBorder,
              backgroundColor: theme.color.glassBackground,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.extrabold,
              },
            ]}
          >
            {copy.status.signedIn}
          </Text>

          <Text
            style={[
              styles.email,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {session.user.email}
          </Text>

          <View
            style={[styles.sessionMeta, { borderColor: theme.color.border }]}
          >
            <Text
              style={[
                styles.metaLabel,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {copy.status.sessionLabel}
            </Text>
            <Text
              style={[
                styles.metaValue,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {session.sessionId.slice(0, 8).toUpperCase()}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.status.logout}
            onPress={onLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.logoutLabel,
                {
                  color: theme.color.background,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {copy.status.logout}
            </Text>
          </Pressable>
        </GlassView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 999,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 28,
  },
  logo: {
    width: 220,
    height: 72,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 12,
    overflow: "hidden",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  email: {
    fontSize: 16,
    lineHeight: 22,
  },
  sessionMeta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 16,
    lineHeight: 22,
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f97316",
    marginTop: 8,
  },
  logoutButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  logoutLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
});
