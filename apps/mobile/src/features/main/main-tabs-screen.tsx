import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { Header } from "./components/header";
import { TabBar } from "./components/tab-bar";
import { HeaderContext, type HeaderOptions } from "./context/header-context";
import { type MainTabKey } from "./main-types";
import { PlanScreen } from "./screens/plan-screen";
import { ProfileScreen } from "./screens/profile-screen";
import { ProgressScreen } from "./screens/progress-screen";
import { TodayScreen } from "./screens/today-screen";
import { IntegrationsScreen } from "./screens/integrations-screen";
import { StravaIntegrationScreen } from "./screens/strava-integration-screen";
import { type AppLanguage, type MainCopy } from "../../locales";
import { type ThemePreference } from "./screens/theme-settings-screen";
import { PlanCreationMethodSheet } from "../plan-creation/components/plan-creation-method-sheet";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  userEmail: string;
  userLanguage: AppLanguage;
  userTheme: ThemePreference;
  onOpenTrefix: () => void;
  onOpenPlanCreation: () => void;
  onLogout: () => void;
  onEditProfile: () => void;
  onOpenNotifications: () => void;
  onOpenLanguage: () => void;
  onOpenTheme: () => void;
};

export function MainTabsScreen({
  theme,
  themeMode,
  copy,
  userEmail,
  userLanguage,
  userTheme,
  onOpenTrefix,
  onOpenPlanCreation,
  onLogout,
  onEditProfile,
  onOpenNotifications,
  onOpenLanguage,
  onOpenTheme,
}: Props) {
  const [activeTab, setActiveTab] = useState<MainTabKey>("today");
  const [subScreen, setSubScreen] = useState<"integrations" | "strava-integration" | null>(null);
  const [headerOptions, setHeaderOptions] = useState<HeaderOptions>({});
  const [planCreationSheetVisible, setPlanCreationSheetVisible] = useState(false);

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
  }, [activeTab, subScreen, fadeAnim, translateAnim]);

  const handleTabChange = (tab: MainTabKey) => {
    setSubScreen(null);
    setActiveTab(tab);
  };

  return (
    <HeaderContext.Provider value={{ options: headerOptions, setOptions: setHeaderOptions }}>
      <View style={[styles.root, { backgroundColor: theme.color.background }]}>
        <Header
          theme={theme}
          themeMode={themeMode}
          leftAction={headerOptions.leftAction}
          centerContent={headerOptions.centerContent}
          rightAction={headerOptions.rightAction}
          variant={headerOptions.variant}
          bottomContent={headerOptions.bottomContent}
        />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateAnim }],
            },
          ]}
        >
          {subScreen === "integrations" ? (
            <IntegrationsScreen
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              userLanguage={userLanguage}
              onBack={() => setSubScreen(null)}
              onOpenStrava={() => setSubScreen("strava-integration")}
            />
          ) : subScreen === "strava-integration" ? (
            <StravaIntegrationScreen
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              userLanguage={userLanguage}
              onBack={() => setSubScreen("integrations")}
            />
          ) : activeTab === "today" ? (
            <TodayScreen theme={theme} themeMode={themeMode} copy={copy} />
          ) : activeTab === "plan" ? (
            <PlanScreen
              copy={copy}
              onOpenPlanCreation={() => setPlanCreationSheetVisible(true)}
              onOpenTrefix={onOpenTrefix}
              theme={theme}
              themeMode={themeMode}
            />
          ) : activeTab === "progress" ? (
            <ProgressScreen
              copy={copy}
              onOpenTrefix={onOpenTrefix}
              theme={theme}
              themeMode={themeMode}
            />
          ) : activeTab === "profile" ? (
            <ProfileScreen
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              userLanguage={userLanguage}
              userTheme={userTheme}
              onLogout={onLogout}
              onEdit={onEditProfile}
              onOpenNotifications={onOpenNotifications}
              onOpenLanguage={onOpenLanguage}
              onOpenTheme={onOpenTheme}
              onOpenIntegrations={() => setSubScreen("integrations")}
            />
          ) : null}
        </Animated.View>

        <TabBar
          theme={theme}
          themeMode={themeMode}
          userEmail={userEmail}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          onOpenTrefix={onOpenTrefix}
        />

        <PlanCreationMethodSheet
          visible={planCreationSheetVisible}
          onClose={() => setPlanCreationSheetVisible(false)}
          onOpenTrefix={() => {
            setPlanCreationSheetVisible(false);
            onOpenTrefix();
          }}
          onCreateManually={() => {
            setPlanCreationSheetVisible(false);
            onOpenPlanCreation();
          }}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
        />
      </View>
    </HeaderContext.Provider>
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
