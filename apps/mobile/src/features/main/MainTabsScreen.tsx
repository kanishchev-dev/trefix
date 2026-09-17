import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { MainLiquidTabBar } from "./components/MainLiquidTabBar";
import { type MainTabKey } from "./main.types";
import { PlanScreen } from "./screens/PlanScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { TodayScreen } from "./screens/TodayScreen";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  userEmail: string;
  onOpenTrefix: () => void;
};

export function MainTabsScreen({
  theme,
  themeMode,
  userEmail,
  onOpenTrefix,
}: Props) {
  const [activeTab, setActiveTab] = useState<MainTabKey>("today");
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    translateAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, fadeAnim, translateAnim]);

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: translateAnim }],
          },
        ]}
      >
        {activeTab === "today" ? <TodayScreen theme={theme} /> : null}
        {activeTab === "plan" ? <PlanScreen theme={theme} /> : null}
        {activeTab === "progress" ? <ProgressScreen theme={theme} /> : null}
        {activeTab === "profile" ? <ProfileScreen theme={theme} /> : null}
      </Animated.View>

      <MainLiquidTabBar
        theme={theme}
        themeMode={themeMode}
        userEmail={userEmail}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenTrefix={onOpenTrefix}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 0,
  },
});
