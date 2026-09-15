import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
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

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const colorScheme = useColorScheme();
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

  return (
    <SafeAreaProvider>
      <AuthScreen theme={theme} themeMode={themeMode} />
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
    </SafeAreaProvider>
  );
}
