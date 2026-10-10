import { type ReactNode, type RefObject, useState, useEffect } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const HEADER_CONTENT_HEIGHT = 56;
const BACKGROUND_TOP_OFFSET = 0; // Start blur exactly from the notch boundary
const BACKGROUND_TOTAL_HEIGHT = 82;
const ACTION_SIZE = 44;
const ACTION_SLOT_WIDTH = 96;

type HeaderProps = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  centerContent: ReactNode;
  blurTarget?: RefObject<View | null>;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  contentHeight?: number;
  variant?: "default" | "calendar";
  bottomContent?: ReactNode;
};

type HeaderActionButtonProps = {
  accessibilityLabel: string;
  icon: ReactNode;
  themeMode: ThemeMode;
  theme: ThemeTokens;
  onPress: () => void;
};

type HeaderTextButtonProps = {
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

export function Header({
  theme,
  themeMode,
  centerContent,
  blurTarget,
  leftAction,
  rightAction,
  contentHeight = HEADER_CONTENT_HEIGHT,
  variant = "default",
  bottomContent,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const isCalendar = variant === "calendar";

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          height: isCalendar
            ? undefined // Let it grow with bottomContent
            : insets.top + Math.max(HEADER_CONTENT_HEIGHT, BACKGROUND_TOP_OFFSET + BACKGROUND_TOTAL_HEIGHT),
        },
      ]}
    >
      {!isCalendar && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + BACKGROUND_TOTAL_HEIGHT,
          }}
        >
          <MaskedView
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            maskElement={
              <LinearGradient
                colors={[
                  "rgba(0, 0, 0, 1)",
                  "rgba(0, 0, 0, 1)",
                  "rgba(0, 0, 0, 0.9)",
                  "rgba(0, 0, 0, 0.7)",
                  "rgba(0, 0, 0, 0.4)",
                  "rgba(0, 0, 0, 0.15)",
                  "rgba(0, 0, 0, 0.05)",
                  "rgba(0, 0, 0, 0)",
                ]}
                locations={[0, 0.55, 0.68, 0.8, 0.9, 0.96, 0.99, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            }
          >
            <View style={StyleSheet.absoluteFill}>
              <BlurView
                blurMethod="dimezisBlurViewSdk31Plus"
                blurTarget={blurTarget}
                intensity={16}
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                tint="regular"
              />

              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: theme.color.background,
                    opacity: themeMode === "dark" ? 0.72 : 0.62,
                  },
                ]}
              />
            </View>
          </MaskedView>
        </View>
      )}

      {isCalendar && (
        <GlassView
          colorScheme={themeMode === "dark" ? "dark" : "light"}
          glassEffectStyle="regular"
          tintColor={theme.color.chromeTint}
          style={[
            StyleSheet.absoluteFill,
            {
              top: -Math.max(insets.top, 40),
              borderBottomLeftRadius: theme.radius.xl,
              borderBottomRightRadius: theme.radius.xl,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              overflow: "hidden",
              left: -StyleSheet.hairlineWidth,
              right: -StyleSheet.hairlineWidth,
              borderWidth: StyleSheet.hairlineWidth,
              borderTopWidth: 0,
              borderColor: theme.color.chromeGlassBorder,
              backgroundColor: theme.color.chromeFill,
            },
          ]}
        />
      )}

      <View
        style={[
          styles.content,
          {
            height: HEADER_CONTENT_HEIGHT,
            marginTop: insets.top,
          },
        ]}
      >
        <View pointerEvents="box-none" style={styles.leftSlot}>
          {leftAction}
        </View>

        <View pointerEvents="none" style={styles.centerSlot}>
          {centerContent}
        </View>

        <View pointerEvents="box-none" style={styles.rightSlot}>
          {rightAction}
        </View>
      </View>

      {isCalendar && bottomContent && (
        <View style={styles.bottomContent}>
          {bottomContent}
        </View>
      )}
    </View>
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
      icon={<ArrowLeft color={theme.color.foreground} size={20} strokeWidth={2.4} />}
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
      icon={<Search color={theme.color.foreground} size={20} strokeWidth={2.2} />}
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
      icon={<EllipsisVertical color={theme.color.foreground} size={20} strokeWidth={2.2} />}
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
      icon={<SlidersHorizontal color={theme.color.foreground} size={20} strokeWidth={2.2} />}
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
      icon={<Sparkles color={theme.color.foreground} size={20} strokeWidth={2.2} />}
      onPress={onPress}
    />
  );
}

export function HeaderLogo({
  source,
}: {
  source: ImageSourcePropType;
}) {
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

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
  },
  content: {
    justifyContent: "center",
  },
  leftSlot: {
    position: "absolute",
    left: 16,
    top: 0,
    bottom: 0,
    width: ACTION_SLOT_WIDTH,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  rightSlot: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    width: ACTION_SLOT_WIDTH,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  centerSlot: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 72,
  },
  bottomContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  logo: {
    width: 168,
    height: 40,
  },
  titlePill: {
    minHeight: 78,
    minWidth: 286,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  titlePillTitle: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  titlePillSubtitle: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 18,
  },
  actionButtonContainer: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
  },
  actionButtonGlass: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  actionButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  textButtonContainer: {
    minHeight: ACTION_SIZE,
  },
  textButtonGlass: {
    minHeight: ACTION_SIZE,
    minWidth: 84,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  textButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  textButtonLabel: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
  },
});

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
      icon={<QrCode color={theme.color.foreground} size={20} strokeWidth={2.2} />}
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
