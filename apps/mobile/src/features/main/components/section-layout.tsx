import { useRef, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurTargetView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { Header } from "./header";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  headerCenter?: ReactNode;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  headerContentHeight?: number;
  headerVariant?: "default" | "calendar";
  headerBottomContent?: ReactNode;
  backgroundContent?: ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  hasHeader?: boolean;
};

export function SectionLayout({
  theme,
  themeMode,
  headerCenter,
  leftAction,
  rightAction,
  headerContentHeight,
  headerVariant = "default",
  headerBottomContent,
  backgroundContent,
  scrollable = false,
  refreshing,
  onRefresh,
  children,
  contentStyle,
  hasHeader = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      {backgroundContent ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {backgroundContent}
        </View>
      ) : null}

      <BlurTargetView ref={blurTargetRef} collapsable={false} style={styles.blurTarget}>
        {scrollable ? (
          <ScrollView
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: insets.top + 78,
                paddingBottom: insets.bottom + 136,
              },
              contentStyle,
            ]}
            scrollIndicatorInsets={{ top: 0, bottom: insets.bottom + 136 }}
            showsVerticalScrollIndicator={false}
            style={styles.scrollView}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing || false}
                  onRefresh={onRefresh}
                  tintColor={theme.color.mutedForeground}
                  colors={[theme.color.primary]}
                  progressViewOffset={insets.top + 20}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.centerContent, contentStyle]}>{children}</View>
        )}
      </BlurTargetView>

      {hasHeader ? (
        <Header
          leftAction={leftAction}
          centerContent={headerCenter}
          blurTarget={blurTargetRef}
          contentHeight={headerContentHeight}
          rightAction={rightAction}
          theme={theme}
          themeMode={themeMode}
          variant={headerVariant}
          bottomContent={headerBottomContent}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blurTarget: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});
