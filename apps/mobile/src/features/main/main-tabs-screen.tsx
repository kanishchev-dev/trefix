import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
import { usePreferences } from "../profile/hooks/use-preferences";
import { ProfileScreen } from "../profile/screens/profile-screen";
import { ProgressScreen } from "../progress/screens/progress-screen";
import { PushedScreen } from "./components/pushed-screen";
import { TabBar } from "./components/tab-bar";
import { openStackScreen, useMainShell, type MainTabParamList } from "./main-routes";
import { type MainTabKey } from "./main-types";
import { PlanScreen } from "./screens/plan-screen";
import { type ThemePreference } from "./screens/theme-settings-screen";
import { TodayScreen } from "./screens/today-screen";

const Tabs = createBottomTabNavigator<MainTabParamList>();

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

/**
 * The four tabs with the glass tab bar. A tab stays mounted after its first
 * visit, so its scroll position and local state survive switching.
 */
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
  const { push, openTrefix } = useMainShell();
  const { preferences } = usePreferences();

  return (
    <Tabs.Navigator
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        animation: "fade",
        freezeOnBlur: true,
        sceneStyle: { backgroundColor: theme.color.background },
      }}
      tabBar={({ state, navigation }) => (
        <TabBar
          theme={theme}
          themeMode={themeMode}
          userEmail={userEmail}
          activeTab={state.routes[state.index]?.name as MainTabKey}
          onChangeTab={(tab) => navigation.navigate(tab)}
          onOpenTrefix={openTrefix}
          showTrefix={preferences.coachEnabled}
        />
      )}
    >
      <Tabs.Screen name="today">
        {() => (
          <PushedScreen theme={theme} themeMode={themeMode}>
            <TodayScreen theme={theme} themeMode={themeMode} copy={copy} />
          </PushedScreen>
        )}
      </Tabs.Screen>
      <Tabs.Screen name="plan">
        {() => (
          <PushedScreen theme={theme} themeMode={themeMode}>
            <PlanScreen copy={copy} language={userLanguage} theme={theme} themeMode={themeMode} />
          </PushedScreen>
        )}
      </Tabs.Screen>
      <Tabs.Screen name="progress">
        {() => (
          <PushedScreen theme={theme} themeMode={themeMode}>
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
          </PushedScreen>
        )}
      </Tabs.Screen>
      <Tabs.Screen name="profile">
        {() => (
          <PushedScreen theme={theme} themeMode={themeMode}>
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
          </PushedScreen>
        )}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}
