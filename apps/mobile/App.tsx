import { useEffect, useMemo, useState } from "react";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { mobileAppName } from "@workspace/config";
import { tokens } from "@workspace/tokens";
import { HomeScreen } from "./src/features/home/HomeScreen";
import { SettingsScreen } from "./src/features/settings/SettingsScreen";
import { loadThemePreference } from "./src/shared/lib/storage";

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    void loadThemePreference().then((value) => {
      setThemeMode(value ?? "light");
    });
  }, []);

  const navigationTheme = useMemo(() => {
    const baseTheme = themeMode === "dark" ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background:
          themeMode === "dark" ? "#020617" : tokens.color.background,
        card: themeMode === "dark" ? "#0f172a" : tokens.color.surface,
        primary: tokens.color.primary,
        text: themeMode === "dark" ? "#e2e8f0" : tokens.color.foreground,
        border: themeMode === "dark" ? "#334155" : tokens.color.border,
        notification: tokens.color.primary,
      },
    };
  }, [themeMode]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: navigationTheme.colors.background }}
          edges={["top", "bottom"]}
        >
          <NavigationContainer theme={navigationTheme}>
            <Stack.Navigator
              initialRouteName="Home"
              screenOptions={{
                headerShadowVisible: false,
                headerStyle: {
                  backgroundColor: navigationTheme.colors.card,
                },
                contentStyle: {
                  backgroundColor: navigationTheme.colors.background,
                },
                headerTitleStyle: {
                  fontWeight: "600",
                },
              }}
            >
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: mobileAppName }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: "Settings" }}
              />
            </Stack.Navigator>
            <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
