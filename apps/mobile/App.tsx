import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, Text, useColorScheme, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";

import { getMobileThemeTokens, type ThemeMode } from "@workspace/tokens";

import { HomeScreen } from "./src/features/home/HomeScreen";
import { OtpScreen } from "./src/features/auth/OtpScreen";
import { WelcomeScreen } from "./src/features/auth/WelcomeScreen";
import type { RootStackParamList } from "./src/navigation/types";
import {
  clearAuthSession,
  loadAuthSession,
  loadCurrentUser,
  logoutAuthSession,
  exchangeMobileSocialAuthCode,
  refreshAuthSession,
  saveAuthSession,
  type AuthSession,
} from "./src/shared/lib/auth";
import { getAppStrings } from "./src/shared/lib/i18n";
import * as Localization from "expo-localization";

void SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const colorScheme = useColorScheme();
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isHandlingAuthCallback, setIsHandlingAuthCallback] = useState(false);
  const [locale, setLocale] = useState<string>("en");

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const systemLocales = Localization.getLocales();
    if (systemLocales.length > 0) {
      setLocale(systemLocales[0].languageCode ?? "en");
    }

    void (async () => {
      const storedSession = await loadAuthSession();
      if (!storedSession) {
        return;
      }

      try {
        const currentUser = await loadCurrentUser(storedSession.tokens.accessToken);
        setAuthSession({
          tokens: storedSession.tokens,
          user: currentUser,
        });
      } catch {
        try {
          const refreshed = await refreshAuthSession(storedSession.tokens.refreshToken);
          const currentUser = await loadCurrentUser(refreshed.tokens.accessToken);
          const nextSession: AuthSession = {
            tokens: refreshed.tokens,
            user: currentUser,
          };
          await saveAuthSession(nextSession);
          setAuthSession(nextSession);
        } catch {
          await clearAuthSession();
          setAuthSession(null);
        }
      } finally {
      }
    })();
  }, []);

  const strings = useMemo(() => getAppStrings(locale), [locale]);
  const themeMode = colorScheme === "dark" ? "dark" : "light";
  const theme = useMemo(() => getMobileThemeTokens(themeMode), [themeMode]);

  useEffect(() => {
    let isActive = true;

    async function handleSocialCallback(url: string): Promise<void> {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== "workspace-mobile:") {
          return;
        }

        const code = parsedUrl.searchParams.get("code");
        const error = parsedUrl.searchParams.get("error");

        if (error) {
          Alert.alert(strings.appName, strings.socialAuthFailed);
          return;
        }

        if (!code) {
          return;
        }

        setIsHandlingAuthCallback(true);
        const session = await exchangeMobileSocialAuthCode({ code });
        await saveAuthSession(session);
        setAuthSession(session);
      } catch {
        await clearAuthSession();
        Alert.alert(strings.appName, strings.socialAuthFailed);
      } finally {
        if (isActive) {
          setIsHandlingAuthCallback(false);
        }
      }
    }

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleSocialCallback(initialUrl);
      }
    })();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleSocialCallback(url);
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [strings.appName, strings.socialAuthFailed]);
  const navigationTheme = useMemo(() => {
    const baseTheme = themeMode === "dark" ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: theme.color.background,
        card: theme.color.surface,
        primary: theme.color.primary,
        text: theme.color.foreground,
        border: theme.color.border,
        notification: theme.color.primary,
      },
    };
  }, [theme]);

  async function handleAuthenticated(session: AuthSession): Promise<void> {
    await saveAuthSession(session);
    setAuthSession(session);
  }

  async function handleSignOut(accessToken: string): Promise<void> {
    try {
      await logoutAuthSession(accessToken);
    } finally {
      await clearAuthSession();
    }
    setAuthSession(null);
  }

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: navigationTheme.colors.background }}
          edges={["top", "bottom"]}
        >
          <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator
              initialRouteName={authSession ? "Home" : "Welcome"}
              screenOptions={{
                headerShadowVisible: false,
                headerStyle: {
                  backgroundColor: navigationTheme.colors.card,
                },
                contentStyle: {
                  backgroundColor: navigationTheme.colors.background,
                },
                headerTitleStyle: {
                  fontFamily: "Inter_600SemiBold",
                },
              }}
            >
              {authSession ? (
                <Stack.Screen name="Home" options={{ title: strings.appName }}>
                  {(props) => (
                    <HomeScreen
                      {...props}
                      strings={strings}
                      theme={theme}
                      session={authSession}
                      onSignOut={() => handleSignOut(authSession.tokens.accessToken)}
                    />
                  )}
                </Stack.Screen>
              ) : (
                <>
                  <Stack.Screen name="Welcome" options={{ headerShown: false }}>
                    {(props) => <WelcomeScreen {...props} strings={strings} theme={theme} themeMode={themeMode} />}
                  </Stack.Screen>
                  <Stack.Screen name="Otp" options={{ title: strings.enterCodeTitle }}>
                    {(props) => (
                      <OtpScreen
                        {...props}
                        strings={strings}
                        theme={theme}
                        onAuthenticated={handleAuthenticated}
                      />
                    )}
                  </Stack.Screen>
                </>
              )}
            </Stack.Navigator>
            <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
