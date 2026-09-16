import { useEffect, useState } from "react";
import { Image, useColorScheme } from "react-native";
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
import { getMobileThemeTokens, type ThemeMode } from "@workspace/tokens";

import { AuthScreen } from "./src/features/auth/AuthScreen";
import { AuthVerificationScreen } from "./src/features/auth/AuthVerificationScreen";

void SplashScreen.preventAutoHideAsync();

type RootStackParamList = {
  email: undefined;
  verification: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
              headerBackButtonDisplayMode: "minimal",
              headerBackTitle: "",
              headerTitle: () => <Image source={logoSource} style={{ width: 184, height: 32 }} resizeMode="contain" />,
            }}
          >
            {() => <AuthVerificationScreen theme={theme} email={email} onSubmitCode={() => {}} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
    </SafeAreaProvider>
  );
}
