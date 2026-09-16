import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
  Platform,
  useColorScheme,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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
} from "@workspace/api-client";
import { getMobileThemeTokens, type ThemeMode } from "@workspace/tokens";

import { AuthenticatedScreen } from "./src/features/auth/AuthenticatedScreen";
import { AuthScreen } from "./src/features/auth/AuthScreen";
import { AuthVerificationScreen } from "./src/features/auth/AuthVerificationScreen";
import {
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
import {
  getGoogleSigninModule,
  isGoogleSigninAvailable,
} from "./src/lib/google-signin";
import {
  getAuthCopy,
  getAppLanguage,
  type AppLanguage,
  type AuthCopy,
} from "./src/locales";

void SplashScreen.preventAutoHideAsync();

type RootStackParamList = {
  email: undefined;
  verification: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function VerificationHeader({
  copy,
  logoSource,
  onBackPress,
}: {
  copy: AuthCopy;
  logoSource: number;
  onBackPress: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.headerRoot,
        { backgroundColor: "#00000000", paddingTop: insets.top },
      ]}
    >
      <View style={styles.headerInner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.verification.back}
          onPress={onBackPress}
          style={styles.backButton}
        >
          <View style={styles.backChevron} />
        </Pressable>

        <Image
          source={logoSource}
          style={styles.headerLogo}
          resizeMode="contain"
        />

        <View style={styles.headerSpacer} />
      </View>
    </View>
  );
}

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
    if (!googleSigninModule) {
      setIsGoogleAuthAvailable(false);
      return;
    }

    googleSigninModule.GoogleSignin.configure({
      webClientId: googleClientId,
      iosClientId: googleClientId,
      offlineAccess: false,
    });
    setIsGoogleAuthAvailable(true);
  }, [googleClientId]);

  useEffect(() => {
    if (isGoogleSigninAvailable()) {
      setIsGoogleAuthAvailable(true);
    }
  }, []);

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
  const copy = getAuthCopy(language);
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
      Alert.alert(
        copy.errors.authFailedTitle,
        error instanceof Error ? error.message : copy.errors.authFailed,
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
        copy.errors.verificationFailedTitle,
        error instanceof Error ? error.message : copy.errors.verificationFailed,
      );
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
        copy.errors.socialFailedTitle,
        error instanceof Error ? error.message : copy.errors.socialFailed,
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
        copy.errors.socialFailedTitle,
        error instanceof Error ? error.message : copy.errors.socialFailed,
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await clearAuthSession().catch(() => undefined);
    setSession(null);
    setChallenge(null);
    setEmail("");
  }

  if (session) {
    return (
      <SafeAreaProvider>
        <AuthenticatedScreen
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          session={session}
          onLogout={() => {
            void handleLogout();
          }}
        />
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
      </SafeAreaProvider>
    );
  }

  const isAuthBusy = isEmailSubmitting || isSocialSubmitting;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: theme.color.background },
            headerTitleAlign: "center",
            headerTintColor: theme.color.foreground,
          }}
        >
          <Stack.Screen name="email" options={{ headerShown: false }}>
            {({ navigation }) => (
              <AuthScreen
                theme={theme}
                themeMode={themeMode}
                copy={copy}
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
          </Stack.Screen>
          <Stack.Screen
            name="verification"
            options={{
              header: ({ navigation }) => (
                <VerificationHeader
                  copy={copy}
                  logoSource={logoSource}
                  onBackPress={() => navigation.goBack()}
                />
              ),
            }}
          >
            {() =>
              challenge ? (
                <AuthVerificationScreen
                  theme={theme}
                  copy={copy}
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
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerRoot: {
    backgroundColor: "transparent",
  },
  headerInner: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    position: "absolute",
    left: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 2,
    transform: [{ rotate: "-45deg" }],
  },
  headerLogo: {
    width: 208,
    height: 36,
  },
  headerSpacer: {
    position: "absolute",
    right: 16,
    width: 32,
    height: 32,
  },
});
