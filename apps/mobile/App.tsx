import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  useColorScheme,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  type AuthTokens,
  type MobileAuthChallenge,
  ApiClientError,
} from "@workspace/api-client";
import { getMobileThemeTokens, type ThemeMode } from "@workspace/tokens";

import { AuthScreen } from "./src/features/auth/auth-screen";
import { AuthVerificationScreen } from "./src/features/auth/auth-verification-screen";
import { MainTabsScreen } from "./src/features/main/main-tabs-screen";
import { TrefixScreen } from "./src/features/main/screens/trefix-screen";
import {
  requestEmailOtp,
  signInWithAppleNative,
  signInWithGoogleNative,
  verifyEmailOtp,
} from "./src/lib/auth-api";
import {
  loadAuthSession,
  saveAuthSession,
} from "./src/lib/auth-session";
import {
  getGoogleSigninModule,
} from "./src/lib/google-signin";
import {
  getAuthCopy,
  getMainCopy,
  getAppLanguage,
  type AppLanguage,
} from "./src/locales";

void SplashScreen.preventAutoHideAsync();

type AuthStackParamList = {
  email: undefined;
  verification: undefined;
};

type MainStackParamList = {
  main: undefined;
  trefix: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

export default function App() {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<MobileAuthChallenge | null>(null);
  const [session, setSession] = useState<AuthTokens | null>(null);
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

  const isReady = (fontsLoaded || fontError) && !isHydratingSession;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  const themeMode: ThemeMode = colorScheme === "dark" ? "dark" : "light";
  const theme = getMobileThemeTokens(themeMode);
  const language: AppLanguage = getAppLanguage();
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
    } catch (error) {
      Alert.alert(
        authCopy.errors.verificationFailedTitle,
        error instanceof Error ? error.message : authCopy.errors.verificationFailed,
      );
      throw error;
    } finally {
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
      <SafeAreaProvider>
        <NavigationContainer>
          <MainStack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            <MainStack.Screen
              name="main"
              options={{ headerShown: false }}
            >
              {({ navigation }) => (
                <MainTabsScreen
                  theme={theme}
                  themeMode={themeMode}
                  copy={mainCopy}
                  userEmail={session.user.email}
                  onOpenTrefix={() => {
                    navigation.navigate("trefix");
                  }}
                />
              )}
            </MainStack.Screen>
            <MainStack.Screen
              name="trefix"
              options={{ headerShown: false }}
            >
              {({ navigation }) => (
                <TrefixScreen
                  onBack={() => {
                    navigation.goBack();
                  }}
                  theme={theme}
                  themeMode={themeMode}
                  copy={mainCopy.trefix}
                />
              )}
            </MainStack.Screen>
          </MainStack.Navigator>
          <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  const isAuthBusy = isEmailSubmitting || isSocialSubmitting;

  return (
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
                  onSubmitCode={(submittedCode) => {
                    void handleVerificationSubmit(submittedCode);
                  }}
                  onResendCode={() => handleResendCode()}
                />
              ) : null
            }
          </AuthStack.Screen>
        </AuthStack.Navigator>
      </NavigationContainer>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
    </SafeAreaProvider>
  );
}
