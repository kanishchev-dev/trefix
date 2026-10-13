import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { getMobileThemeTokens, type ThemeMode } from "@trefix/tokens";

import { useAppPreferences } from "./src/app/use-app-preferences";
import { AuthNavigator } from "./src/features/auth/auth-navigator";
import { useSession } from "./src/features/auth/use-session";
import { useSignIn } from "./src/features/auth/use-sign-in";
import { MainNavigator } from "./src/features/main/main-navigator";
import { mainNavigationRef } from "./src/features/main/main-routes";
import { setRequestLanguage } from "./src/lib/api-client";
import { RealtimeProvider } from "./src/lib/realtime";
import { getAppLanguage, getAuthCopy, getMainCopy } from "./src/locales";

void SplashScreen.preventAutoHideAsync();
// Device language until the stored choice is read, so the first requests are localized too.
setRequestLanguage(getAppLanguage());

export default function App() {
  const colorScheme = useColorScheme();
  const session = useSession();
  const preferences = useAppPreferences(session.session);
  const authCopy = getAuthCopy(preferences.language);
  const signIn = useSignIn(authCopy, session.signIn);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const isReady = Boolean(fontsLoaded || fontError) && !session.isHydrating;

  const hasSession = Boolean(session.session);

  useEffect(() => {
    // Signed out: the auth screen hides the splash itself, once its first frame
    // matches the splash, and animates out of it.
    if (isReady && hasSession) {
      void SplashScreen.hideAsync();
    }
  }, [isReady, hasSession]);

  if (!isReady) {
    return null;
  }

  const themeMode: ThemeMode =
    preferences.userTheme === "system"
      ? colorScheme === "dark"
        ? "dark"
        : "light"
      : preferences.userTheme;
  const theme = getMobileThemeTokens(themeMode);
  const statusBar = (
    <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
  );

  if (session.session) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={session.queryClient}>
          <RealtimeProvider
            accessToken={session.session.accessToken}
            onAuthError={() => {
              void session.signOut();
            }}
          >
            <SafeAreaProvider>
              <NavigationContainer ref={mainNavigationRef}>
                <MainNavigator
                  theme={theme}
                  themeMode={themeMode}
                  copy={getMainCopy(preferences.language)}
                  userEmail={session.session.user.email}
                  language={preferences.language}
                  userTheme={preferences.userTheme}
                  onLogout={session.signOut}
                  onAccountDeleted={() => void session.endDeletedAccount()}
                  onSelectLanguage={preferences.selectLanguage}
                  onSelectTheme={preferences.selectTheme}
                />
                {statusBar}
              </NavigationContainer>
            </SafeAreaProvider>
          </RealtimeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={session.queryClient}>
        <SafeAreaProvider>
          <NavigationContainer>
            <AuthNavigator
              theme={theme}
              themeMode={themeMode}
              copy={authCopy}
              logoSource={
                themeMode === "dark"
                  ? require("./assets/trefix-logo-light.png")
                  : require("./assets/trefix-logo-dark.png")
              }
              signIn={signIn}
            />
          </NavigationContainer>
          {statusBar}
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
