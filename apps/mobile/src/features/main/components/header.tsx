import { type ReactNode, type RefObject } from "react";
import { StyleSheet, View } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import {
  HEADER_CONTENT_HEIGHT,
  BACKGROUND_TOP_OFFSET,
  BACKGROUND_TOTAL_HEIGHT,
  styles,
} from "./header.styles";
export {
  HeaderActionButton,
  HeaderTextButton,
  HeaderBackButton,
  HeaderMenuButton,
  HeaderSearchButton,
  HeaderBellButton,
  HeaderPlusButton,
  HeaderOptionsButton,
  HeaderFiltersButton,
  HeaderSparklesButton,
  HeaderLogo,
  HeaderTitlePill,
  HeaderQrButton,
  HeaderTitle,
} from "./header-buttons";

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
  tone?: "screen" | "surface";
};

export function Header({
  theme,
  themeMode,
  centerContent,
  blurTarget,
  leftAction,
  rightAction,
  variant = "default",
  bottomContent,
  tone = "screen",
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
            : insets.top +
              Math.max(
                HEADER_CONTENT_HEIGHT,
                BACKGROUND_TOP_OFFSET + BACKGROUND_TOTAL_HEIGHT,
              ),
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
                    backgroundColor:
                      tone === "surface"
                        ? theme.color.card
                        : theme.color.screen,
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
        <View style={styles.bottomContent}>{bottomContent}</View>
      )}
    </View>
  );
}
