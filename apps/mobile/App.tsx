import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { getMobileThemeTokens, type ThemeMode } from "@workspace/tokens";

import { AuthScreen } from "./src/features/auth/AuthScreen";
import { AuthVerificationScreen } from "./src/features/auth/AuthVerificationScreen";
import { getAuthCopy, getAppLanguage, type AppLanguage, type AuthCopy } from "./src/locales";

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
    <View style={[styles.headerRoot, { backgroundColor: "#00000000", paddingTop: insets.top }]}>
      <View style={styles.headerInner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.verification.back}
          onPress={onBackPress}
          style={styles.backButton}
        >
          <View style={styles.backChevron} />
        </Pressable>

        <Image source={logoSource} style={styles.headerLogo} resizeMode="contain" />

        <View style={styles.headerSpacer} />
      </View>
    </View>
  );
}

export default function App() {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
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
                onEmailChange={setEmail}
                onSubmitEmail={(submittedEmail) => {
                  setEmail(submittedEmail);
                  navigation.navigate("verification");
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
            {() => <AuthVerificationScreen theme={theme} copy={copy} email={email} onSubmitCode={() => {}} />}
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
