import { type ReactNode, useState, useEffect } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { GlassView } from "expo-glass-effect";
import {
  ArrowLeft,
  Bell,
  EllipsisVertical,
  Menu,
  Plus,
  QrCode,
  Search,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react-native";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { styles } from "./header.styles";

export type HeaderActionButtonProps = {
  accessibilityLabel: string;
  icon: ReactNode;
  themeMode: ThemeMode;
  theme: ThemeTokens;
  onPress: () => void;
};

export type HeaderTextButtonProps = {
  accessibilityLabel: string;
  label: string;
  themeMode: ThemeMode;
  onPress: () => void;
  theme: ThemeTokens;
};

export function HeaderActionButton({
  accessibilityLabel,
  icon,
  themeMode,
  theme,
  onPress,
}: HeaderActionButtonProps) {
  const [isMounted, setIsMounted] = useState(false);
  const isDark = themeMode === "dark";

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButtonContainer,
        pressed && styles.actionButtonPressed,
      ]}
    >
      {isMounted ? (
        <GlassView
          key={`header-action-${themeMode}`}
          colorScheme={isDark ? "dark" : "light"}
          glassEffectStyle="regular"
          isInteractive
          tintColor={theme.color.chromeTint}
          style={[
            styles.actionButtonGlass,
            {
              borderColor: theme.color.chromeGlassBorder,
              backgroundColor: theme.color.chromeFill,
            },
          ]}
        >
          {icon}
        </GlassView>
      ) : (
        <View
          style={[
            styles.actionButtonGlass,
            {
              borderColor: theme.color.chromeBorder,
              backgroundColor: theme.color.chromeFill,
            },
          ]}
        >
          {icon}
        </View>
      )}
    </Pressable>
  );
}

export function HeaderTextButton({
  accessibilityLabel,
  label,
  themeMode,
  onPress,
  theme,
}: HeaderTextButtonProps) {
  const [isMounted, setIsMounted] = useState(false);
  const isDark = themeMode === "dark";

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [
        styles.textButtonContainer,
        pressed && styles.textButtonPressed,
      ]}
    >
      {isMounted ? (
        <GlassView
          key={`header-text-${themeMode}`}
          colorScheme={isDark ? "dark" : "light"}
          glassEffectStyle="regular"
          isInteractive
          tintColor={theme.color.chromeTint}
          style={[
            styles.textButtonGlass,
            {
              borderColor: theme.color.chromeGlassBorder,
              backgroundColor: theme.color.chromeFill,
            },
          ]}
        >
          <Text
            style={[
              styles.textButtonLabel,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {label}
          </Text>
        </GlassView>
      ) : (
        <View
          style={[
            styles.textButtonGlass,
            {
              borderColor: theme.color.chromeBorder,
              backgroundColor: theme.color.chromeFill,
            },
          ]}
        >
          <Text
            style={[
              styles.textButtonLabel,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function HeaderBackButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="Back"
      themeMode={themeMode}
      theme={theme}
      icon={
        <ArrowLeft color={theme.color.foreground} size={20} strokeWidth={2.4} />
      }
      onPress={onPress}
    />
  );
}

export function HeaderMenuButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="Menu"
      themeMode={themeMode}
      theme={theme}
      icon={<Menu color={theme.color.foreground} size={20} strokeWidth={2.2} />}
      onPress={onPress}
    />
  );
}

export function HeaderSearchButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="Search"
      themeMode={themeMode}
      theme={theme}
      icon={
        <Search color={theme.color.foreground} size={20} strokeWidth={2.2} />
      }
      onPress={onPress}
    />
  );
}

export function HeaderBellButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="Events"
      themeMode={themeMode}
      theme={theme}
      icon={<Bell color={theme.color.foreground} size={20} strokeWidth={2.2} />}
      onPress={onPress}
    />
  );
}

export function HeaderPlusButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="Add"
      themeMode={themeMode}
      theme={theme}
      icon={<Plus color={theme.color.foreground} size={20} strokeWidth={2.4} />}
      onPress={onPress}
    />
  );
}

export function HeaderOptionsButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="More"
      themeMode={themeMode}
      theme={theme}
      icon={
        <EllipsisVertical
          color={theme.color.foreground}
          size={20}
          strokeWidth={2.2}
        />
      }
      onPress={onPress}
    />
  );
}

export function HeaderFiltersButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="Filters"
      themeMode={themeMode}
      theme={theme}
      icon={
        <SlidersHorizontal
          color={theme.color.foreground}
          size={20}
          strokeWidth={2.2}
        />
      }
      onPress={onPress}
    />
  );
}

export function HeaderSparklesButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="Trefix"
      themeMode={themeMode}
      theme={theme}
      icon={
        <Sparkles color={theme.color.foreground} size={20} strokeWidth={2.2} />
      }
      onPress={onPress}
    />
  );
}

export function HeaderLogo({ source }: { source: ImageSourcePropType }) {
  return <Image source={source} style={styles.logo} resizeMode="contain" />;
}

export function HeaderTitlePill({
  theme,
  title,
  subtitle,
}: {
  theme: ThemeTokens;
  title: string;
  subtitle: string;
}) {
  return (
    <View
      style={[
        styles.titlePill,
        {
          backgroundColor: theme.color.aiPill,
          borderColor: theme.color.aiSurface,
        },
      ]}
    >
      <Text
        style={[
          styles.titlePillTitle,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.titlePillSubtitle,
          {
            color: theme.color.info,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

export function HeaderQrButton({
  theme,
  themeMode,
  onPress,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  return (
    <HeaderActionButton
      accessibilityLabel="QR Code"
      themeMode={themeMode}
      theme={theme}
      icon={
        <QrCode color={theme.color.foreground} size={20} strokeWidth={2.2} />
      }
      onPress={onPress}
    />
  );
}

export function HeaderTitle({
  theme,
  children,
}: {
  theme: ThemeTokens;
  children: string;
}) {
  return (
    <Text
      numberOfLines={1}
      style={{
        color: theme.color.foreground,
        fontFamily: theme.typography.fontFamily.sans.medium,
        fontSize: 17,
        lineHeight: 22,
        textAlign: "center",
      }}
    >
      {children}
    </Text>
  );
}
