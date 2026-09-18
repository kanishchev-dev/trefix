import { type ReactNode } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import appConfig from "../../../../app.json";
import {
  Bell,
  ChevronRight,
  Languages,
  Palette,
  QrCode,
  UserRound,
} from "lucide-react-native";

import { type ThemeTokens } from "@workspace/tokens";

import { HeaderLogo, HeaderMenuButton, HeaderTextButton } from "../components/header";
import { SectionLayout } from "../components/section-layout";
import {
  formatProfileJoinedDate,
  getAppLanguage,
  type MainCopy,
} from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

type ProfileRowProps = {
  theme: ThemeTokens;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  compact?: boolean;
  destructive?: boolean;
  destructiveColor?: string;
  showChevron?: boolean;
  onPress?: () => void;
};

function ProfileRow({
  theme,
  title,
  subtitle,
  icon,
  compact = false,
  destructive = false,
  destructiveColor = "#dc2626",
  showChevron = true,
  onPress,
}: ProfileRowProps) {
  const content = (
    <View style={[styles.rowContent, compact && styles.rowContentCompact]}>
      {icon ? <View style={styles.rowIconWrap}>{icon}</View> : null}

      <View style={styles.rowTextWrap}>
        <Text
          style={[
            styles.rowTitle,
            {
              color: destructive ? destructiveColor : theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.rowSubtitle,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {showChevron ? (
        <ChevronRight
          color={theme.color.mutedForeground}
          size={18}
          strokeWidth={2.2}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        pressed && styles.rowPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function ProfileScreen({ theme, themeMode, copy }: Props) {
  const language = getAppLanguage();
  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  const profileJoinedAt = new Date(2026, 8, 1);
  const appVersion = appConfig.expo.version ?? "1.0.0";

  return (
    <SectionLayout
      leftAction={
        <HeaderMenuButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => undefined}
        />
      }
      headerCenter={<HeaderLogo source={logoSource} />}
      rightAction={
        <HeaderTextButton
          theme={theme}
          themeMode={themeMode}
          accessibilityLabel={copy.profile.hero.edit}
          label={copy.profile.hero.edit}
          onPress={() => undefined}
        />
      }
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.stack}>
        <View style={styles.hero}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
              },
            ]}
          >
            <UserRound
              color={theme.color.foreground}
              size={34}
              strokeWidth={1.9}
            />
          </View>

          <Text
            style={[
              styles.name,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {copy.profile.hero.name}
          </Text>

          <Text
            style={[
              styles.joined,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {formatProfileJoinedDate(profileJoinedAt, language)}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: theme.color.border,
            },
          ]}
        >
          <ProfileRow
            theme={theme}
            title={copy.profile.referral.title}
            icon={<QrCode color={theme.color.foreground} size={18} strokeWidth={2.1} />}
            showChevron
            onPress={() => undefined}
          />
        </View>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.profile.settings.title}
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
              },
            ]}
          >
            <ProfileRow
              theme={theme}
              title={copy.profile.settings.notifications}
              compact
              icon={
                <Bell
                  color={theme.color.foreground}
                  size={18}
                  strokeWidth={2.1}
                />
              }
              onPress={() => undefined}
            />
            <View
              style={[
                styles.separator,
                { backgroundColor: theme.color.border },
              ]}
            />
            <ProfileRow
              theme={theme}
              title={copy.profile.settings.language}
              compact
              icon={
                <Languages
                  color={theme.color.foreground}
                  size={18}
                  strokeWidth={2.1}
                />
              }
              onPress={() => undefined}
            />
            <View
              style={[
                styles.separator,
                { backgroundColor: theme.color.border },
              ]}
            />
            <ProfileRow
              theme={theme}
              title={copy.profile.settings.theme}
              compact
              icon={
                <Palette
                  color={theme.color.foreground}
                  size={18}
                  strokeWidth={2.1}
                />
              }
              onPress={() => undefined}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => undefined}
          style={({ pressed }) => [
            styles.destructiveButton,
            {
              backgroundColor:
                themeMode === "dark"
                  ? "rgba(67, 26, 26, 0.96)"
                  : "rgba(255, 235, 235, 1)",
              borderColor:
                themeMode === "dark"
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(220, 38, 38, 0.12)",
            },
            pressed && styles.destructiveButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.destructiveText,
              {
                color: "#ff6b6b",
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.profile.danger.title}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => undefined}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              backgroundColor: theme.color.primary,
              borderColor: theme.color.primary,
            },
            pressed && styles.logoutButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.logoutText,
              {
                color: theme.color.primaryForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.profile.logout}
          </Text>
        </Pressable>

        <View style={styles.legalLinks}>
          <Text
            accessibilityRole="link"
            onPress={() =>
              Linking.openURL(
                process.env.EXPO_PUBLIC_PRIVACY_URL ??
                  "https://trefix.run/privacy",
              )
            }
            style={[
              styles.legalLink,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.profile.legal.privacy}
          </Text>
          <Text
            accessibilityRole="link"
            onPress={() =>
              Linking.openURL(
                process.env.EXPO_PUBLIC_TERMS_URL ??
                  "https://trefix.run/terms",
              )
            }
            style={[
              styles.legalLink,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.profile.legal.terms}
          </Text>
        </View>

        <Text
          style={[
            styles.version,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {copy.profile.version} {appVersion}
        </Text>
      </View>
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 18,
  },
  hero: {
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  joined: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  rowCompact: {
    minHeight: 52,
    paddingVertical: 8,
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowContent: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowContentCompact: {
    minHeight: 32,
  },
  rowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  logoutButton: {
    minHeight: 48,
    alignSelf: "stretch",
    width: "100%",
    paddingHorizontal: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  logoutText: {
    fontSize: 15,
    lineHeight: 20,
  },
  destructiveButton: {
    minHeight: 48,
    alignSelf: "stretch",
    width: "100%",
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  destructiveButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  destructiveText: {
    fontSize: 15,
    lineHeight: 20,
  },
  legalLinks: {
    gap: 12,
    paddingTop: 4,
    alignItems: "center",
  },
  legalLink: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  version: {
    paddingTop: 4,
    paddingBottom: 16,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
