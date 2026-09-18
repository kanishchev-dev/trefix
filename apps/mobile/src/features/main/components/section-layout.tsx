import { useRef, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
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
  headerCenter: ReactNode;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  headerContentHeight?: number;
  backgroundContent?: ReactNode;
  scrollable?: boolean;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function SectionLayout({
  theme,
  themeMode,
  headerCenter,
  leftAction,
  rightAction,
  headerContentHeight,
  backgroundContent,
  scrollable = false,
  children,
  contentStyle,
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
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.centerContent, contentStyle]}>{children}</View>
        )}
      </BlurTargetView>

      <Header
        leftAction={leftAction}
        centerContent={headerCenter}
        blurTarget={blurTargetRef}
        contentHeight={headerContentHeight}
        rightAction={rightAction}
        theme={theme}
        themeMode={themeMode}
      />
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
