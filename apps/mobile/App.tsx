import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Platform, useColorScheme } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  MutationCache,
} from "@tanstack/react-query";
import {
  type AuthTokens,
  type MobileAuthChallenge,
  ApiClientError,
} from "@workspace/api-client";
import { getMobileThemeTokens, type ThemeMode } from "@workspace/tokens";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { AuthScreen } from "./src/features/auth/auth-screen";
import { AuthVerificationScreen } from "./src/features/auth/auth-verification-screen";
import { MainNavigator } from "./src/features/main/main-navigator";
import { mainNavigationRef } from "./src/features/main/main-routes";
import { type ThemePreference } from "./src/features/main/screens/theme-settings-screen";
import {
  logout,
  requestEmailOtp,
  signInWithAppleNative,
  signInWithGoogleNative,
  verifyEmailOtp,
} from "./src/lib/auth-api";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from "./src/lib/auth-session";
import { useAuthSessionMonitor } from "./src/lib/use-auth-session-monitor";
import { setRequestLanguage } from "./src/lib/api-client";
import { logger } from "./src/lib/logger";
import { updatePreferences } from "./src/lib/preferences-api";
import { RealtimeProvider } from "./src/lib/realtime";
import { disableHealthBackground } from "./src/features/health-sync/background-control";
import { clearHealthSyncState } from "./src/features/health-sync/state";
import { getGoogleSigninModule } from "./src/lib/google-signin";
import {
  getAuthCopy,
  getMainCopy,
  getAppLanguage,
  type AppLanguage,
} from "./src/locales";

void SplashScreen.preventAutoHideAsync();
// Device language until the stored choice is read, so the first requests are localized too.
setRequestLanguage(getAppLanguage());

type AuthStackParamList = {
  email: undefined;
  verification: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export default function App() {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<MobileAuthChallenge | null>(null);
  const [session, setSession] = useState<AuthTokens | null>(null);

  const [userLanguage, setUserLanguage] = useState<AppLanguage | null>(null);
  const [userTheme, setUserTheme] = useState<ThemePreference>("system");
  const [arePreferencesLoaded, setArePreferencesLoaded] = useState(false);

  // The client lives for the app's lifetime; it reaches the current logout through a ref.
  const logoutRef = useRef<() => Promise<void>>(async () => undefined);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiClientError && error.status === 401) {
              void logoutRef.current();
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (error instanceof ApiClientError && error.status === 401) {
              void logoutRef.current();
            }
          },
        }),
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 1000 * 60 * 5, // 5 minutes
          },
        },
      }),
    [],
  );

  logoutRef.current = handleLogout;

  async function handleLogout(): Promise<void> {
    try {
      await logout();
    } catch (error) {
      logger.warn("Logout request failed:", error);
    } finally {
      // The next account on this device must not inherit Health sync or its background wake-ups.
      await disableHealthBackground();
      await clearHealthSyncState();
      await clearAuthSession();
      setSession(null);
      queryClient.clear();
    }
  }

  /** After the account is deleted: drop local data except language and theme, then end the session. */
  async function handleAccountDeleted(): Promise<void> {
    await disableHealthBackground();
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(
        keys.filter(
          (key) => key !== "@trefix/language" && key !== "@trefix/theme",
        ),
      );
      await getGoogleSigninModule()?.GoogleSignin.signOut();
    } catch (error) {
      logger.warn("Local cleanup after account deletion failed:", error);
    }
    await clearAuthSession();
    setSession(null);
    queryClient.clear();
  }

  useAuthSessionMonitor({
    session,
    onSessionUpdated: (nextSession) => {
      logger.debug("[App] Updating active session with refreshed tokens...");
      setSession(nextSession);
    },
    onLogout: handleLogout,
  });

  const [isHydratingSession, setIsHydratingSession] = useState(true);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isVerificationSubmitting, setIsVerificationSubmitting] =
    useState(false);
  const [isSocialSubmitting, setIsSocialSubmitting] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [isGoogleAuthAvailable, setIsGoogleAuthAvailable] = useState(false);
  const googleClientId =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
    "678050162933-nuf4qfic96t8apc5qbf65udlp4n64582.apps.googleusercontent.com";
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    let isActive = true;

    async function hydrateSession(): Promise<void> {
      const storedSession = await loadAuthSession();
      if (!isActive) {
        return;
      }

      setSession(storedSession);
      setIsHydratingSession(false);
    }

    void hydrateSession();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const googleSigninModule = getGoogleSigninModule();
    if (googleSigninModule) {
      googleSigninModule.GoogleSignin.configure({
        webClientId: googleClientId,
        iosClientId: googleClientId,
        offlineAccess: false,
      });
      setIsGoogleAuthAvailable(true);
    } else {
      setIsGoogleAuthAvailable(false);
    }
  }, [googleClientId]);

  useEffect(() => {
    let isActive = true;

    async function resolveAppleAvailability(): Promise<void> {
      if (Platform.OS !== "ios") {
        if (isActive) {
          setIsAppleAuthAvailable(false);
        }
        return;
      }

      const available = await AppleAuthentication.isAvailableAsync();
      if (isActive) {
        setIsAppleAuthAvailable(available);
      }
    }

    void resolveAppleAvailability();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const storedLang = await AsyncStorage.getItem("@trefix/language");
        if (storedLang === "ru" || storedLang === "en") {
          setUserLanguage(storedLang);
        }
        const storedTheme = await AsyncStorage.getItem("@trefix/theme");
        if (
          storedTheme === "system" ||
          storedTheme === "dark" ||
          storedTheme === "light"
        ) {
          setUserTheme(storedTheme as ThemePreference);
        }
      } catch (error) {
        logger.warn("Failed to load user preferences:", error);
      } finally {
        setArePreferencesLoaded(true);
      }
    }
    void loadPreferences();
  }, []);

  const effectiveLanguage: AppLanguage = userLanguage ?? getAppLanguage();
  const reportedLanguageRef = useRef<string | null>(null);

  // The backend answers (error messages) and writes (coach messages, emails)
  // in the app language, so it has to know it.
  useEffect(() => {
    setRequestLanguage(effectiveLanguage);
    if (!session || !arePreferencesLoaded) {
      return;
    }
    const reportKey = `${session.sessionId}:${effectiveLanguage}`;
    if (reportedLanguageRef.current === reportKey) {
      return;
    }
    reportedLanguageRef.current = reportKey;
    updatePreferences({ language: effectiveLanguage }).catch(
      (error: unknown) => {
        reportedLanguageRef.current = null;
        logger.warn("Failed to report the app language:", error);
      },
    );
  }, [session, effectiveLanguage, arePreferencesLoaded]);

  const handleSelectLanguage = (nextLanguage: AppLanguage) => {
    setUserLanguage(nextLanguage);
    void AsyncStorage.setItem("@trefix/language", nextLanguage);
  };

  const handleSelectTheme = (nextTheme: ThemePreference) => {
    setUserTheme(nextTheme);
    void AsyncStorage.setItem("@trefix/theme", nextTheme);
  };

  const isReady = (fontsLoaded || fontError) && !isHydratingSession;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  const themeMode: ThemeMode =
    userTheme === "system"
      ? colorScheme === "dark"
        ? "dark"
        : "light"
      : userTheme;
  const theme = getMobileThemeTokens(themeMode);
  const language = effectiveLanguage;
  const authCopy = getAuthCopy(language);
  const mainCopy = getMainCopy(language);
  const logoSource =
    themeMode === "dark"
      ? require("./assets/trefix-logo-light.png")
      : require("./assets/trefix-logo-dark.png");

  async function handleEmailSubmit(
    submittedEmail: string,
    onSuccess: () => void,
  ): Promise<void> {
    const normalizedEmail = submittedEmail.trim();

    setIsEmailSubmitting(true);
    try {
      const nextChallenge = await requestEmailOtp(normalizedEmail);
      setEmail(nextChallenge.email);
      setChallenge(nextChallenge);
      onSuccess();
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === "AUTH_VERIFICATION_CODE_RATE_LIMITED"
      ) {
        // If code was sent recently, allow navigating to verification screen
        // with estimated countdowns
        setEmail(normalizedEmail);
        setChallenge({
          email: normalizedEmail,
          expiresInSeconds: 600, // 10 mins default
          resendAfterSeconds: 60, // 60s default
        });
        onSuccess();
        return;
      }

      Alert.alert(
        authCopy.errors.authFailedTitle,
        error instanceof Error ? error.message : authCopy.errors.authFailed,
      );
    } finally {
      setIsEmailSubmitting(false);
    }
  }

  async function handleVerificationSubmit(code: string): Promise<void> {
    const activeChallenge = challenge;
    if (!activeChallenge) {
      return;
    }

    setIsVerificationSubmitting(true);
    try {
      const tokens = await verifyEmailOtp(activeChallenge.email, code);
      await saveAuthSession(tokens);
      setSession(tokens);
    } finally {
      // The error is shown on the code screen: an alert would take the keyboard away.
      setIsVerificationSubmitting(false);
    }
  }

  async function handleResendCode(): Promise<MobileAuthChallenge> {
    const activeChallenge = challenge;
    if (!activeChallenge) {
      throw new Error("Verification challenge is missing");
    }

    const nextChallenge = await requestEmailOtp(activeChallenge.email);
    setEmail(nextChallenge.email);
    setChallenge(nextChallenge);
    return nextChallenge;
  }

  async function handleSocialPress(): Promise<void> {
    setIsSocialSubmitting(true);
    try {
      const tokens = await signInWithGoogleNative();
      if (!tokens) {
        return;
      }

      await saveAuthSession(tokens);
      setSession(tokens);
    } catch (error) {
      Alert.alert(
        authCopy.errors.socialFailedTitle,
        error instanceof Error ? error.message : authCopy.errors.socialFailed,
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }

  async function handleApplePress(): Promise<void> {
    setIsSocialSubmitting(true);
    try {
      const tokens = await signInWithAppleNative();
      if (!tokens) {
        return;
      }

      await saveAuthSession(tokens);
      setSession(tokens);
    } catch (error) {
      Alert.alert(
        authCopy.errors.socialFailedTitle,
        error instanceof Error ? error.message : authCopy.errors.socialFailed,
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }

  if (session) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <RealtimeProvider
            accessToken={session.accessToken}
            onAuthError={() => {
              void handleLogout();
            }}
          >
            <SafeAreaProvider>
              <NavigationContainer ref={mainNavigationRef}>
                <MainNavigator
                  theme={theme}
                  themeMode={themeMode}
                  copy={mainCopy}
                  userEmail={session.user.email}
                  language={language}
                  userTheme={userTheme}
                  onLogout={handleLogout}
                  onAccountDeleted={() => void handleAccountDeleted()}
                  onSelectLanguage={handleSelectLanguage}
                  onSelectTheme={handleSelectTheme}
                />
                <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
              </NavigationContainer>
            </SafeAreaProvider>
          </RealtimeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    );
  }

  const isAuthBusy = isEmailSubmitting || isSocialSubmitting;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NavigationContainer>
            <AuthStack.Navigator
              screenOptions={{
                headerShadowVisible: false,
                headerStyle: { backgroundColor: theme.color.background },
                headerTitleAlign: "center",
                headerTintColor: theme.color.foreground,
              }}
            >
              <AuthStack.Screen
                name="email"
                options={{ headerShown: false, headerBackTitle: "" }}
              >
                {({ navigation }) => (
                  <AuthScreen
                    theme={theme}
                    themeMode={themeMode}
                    copy={authCopy}
                    email={email}
                    isEmailSubmitting={isAuthBusy}
                    isSocialSubmitting={isSocialSubmitting}
                    isSocialDisabled={isAuthBusy}
                    showGoogleButton={isGoogleAuthAvailable}
                    showAppleButton={isAppleAuthAvailable}
                    onEmailChange={setEmail}
                    onSubmitEmail={(submittedEmail) => {
                      setEmail(submittedEmail);
                      void handleEmailSubmit(submittedEmail, () =>
                        navigation.navigate("verification"),
                      );
                    }}
                    onGooglePress={() => {
                      void handleSocialPress();
                    }}
                    onApplePress={() => {
                      void handleApplePress();
                    }}
                  />
                )}
              </AuthStack.Screen>
              <AuthStack.Screen
                name="verification"
                options={{
                  headerTransparent: true,
                  headerBackButtonDisplayMode: "minimal",
                  headerTitle: () => (
                    <Image
                      source={logoSource}
                      style={{ width: 160, height: 40 }}
                      resizeMode="contain"
                    />
                  ),
                  headerTintColor: theme.color.foreground,
                  headerBackTitle: "",
                }}
              >
                {() =>
                  challenge ? (
                    <AuthVerificationScreen
                      theme={theme}
                      copy={authCopy}
                      email={email}
                      challenge={challenge}
                      isSubmitting={isVerificationSubmitting}
                      onSubmitCode={handleVerificationSubmit}
                      onResendCode={() => handleResendCode()}
                    />
                  ) : null
                }
              </AuthStack.Screen>
            </AuthStack.Navigator>
          </NavigationContainer>
          <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
