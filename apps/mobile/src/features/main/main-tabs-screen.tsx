import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
import { usePreferences } from "../profile/hooks/use-preferences";
import { ProfileScreen } from "../profile/screens/profile-screen";
import { ProgressScreen } from "../progress/screens/progress-screen";
import { Header } from "./components/header";
import { TabBar } from "./components/tab-bar";
import { HeaderContext, type HeaderOptions } from "./context/header-context";
import { openStackScreen, useMainShell } from "./main-routes";
import { type MainTabKey } from "./main-types";
import { PlanScreen } from "./screens/plan-screen";
import { type ThemePreference } from "./screens/theme-settings-screen";
import { TodayScreen } from "./screens/today-screen";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  userEmail: string;
  userLanguage: AppLanguage;
  userTheme: ThemePreference;
  onLogout: () => void;
  onAccountDeleted: () => void;
};

// Module-level so their identity is stable: tab screens list them in `useHeaderOptions` deps.
const openProfileEdit = () => openStackScreen("profileEdit");
const openNotifications = () => openStackScreen("notificationsSettings");
const openLanguage = () => openStackScreen("languageSettings");
const openTheme = () => openStackScreen("themeSettings");

/** The four tabs under a shared header and tab bar; deeper screens are pushed by `MainNavigator`. */
export function MainTabsScreen({
  theme,
  themeMode,
  copy,
  userEmail,
  userLanguage,
  userTheme,
  onLogout,
  onAccountDeleted,
}: Props) {
  const { activeTab, setActiveTab, push, openTrefix } = useMainShell();
  const [headerOptions, setHeaderOptions] = useState<HeaderOptions>({});
  const { preferences } = usePreferences();

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

  const handleTabChange = (tab: MainTabKey) => setActiveTab(tab);
  const headerContext = useMemo(() => ({ options: headerOptions, setOptions: setHeaderOptions }), [headerOptions]);

  return (
    <HeaderContext.Provider value={headerContext}>
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
          {activeTab === "today" ? (
            <TodayScreen theme={theme} themeMode={themeMode} copy={copy} />
          ) : activeTab === "plan" ? (
            <PlanScreen copy={copy} language={userLanguage} theme={theme} themeMode={themeMode} />
          ) : activeTab === "progress" ? (
            <ProgressScreen
              copy={copy}
              language={userLanguage}
              theme={theme}
              themeMode={themeMode}
              coachEnabled={preferences.coachEnabled}
              onOpenTrefix={openTrefix}
              onOpenRecords={() => push({ kind: "progress-records" })}
              onOpenMetric={(metric) => push({ kind: "progress-metric", metric })}
              onOpenHeart={() => push({ kind: "profile-heart" })}
              onOpenSchedule={() => push({ kind: "profile-schedule" })}
            />
          ) : activeTab === "profile" ? (
            <ProfileScreen
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              userLanguage={userLanguage}
              userTheme={userTheme}
              onLogout={onLogout}
              onEdit={openProfileEdit}
              onOpenNotifications={openNotifications}
              onOpenLanguage={openLanguage}
              onOpenTheme={openTheme}
              onOpenIntegrations={() => push({ kind: "integrations" })}
              onOpenStrava={() => push({ kind: "strava-integration" })}
              onNavigate={push}
              onAccountDeleted={onAccountDeleted}
            />
          ) : null}
        </Animated.View>

        <TabBar
          theme={theme}
          themeMode={themeMode}
          userEmail={userEmail}
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          onOpenTrefix={openTrefix}
          showTrefix={preferences.coachEnabled}
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
