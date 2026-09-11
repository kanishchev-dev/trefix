import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const keys = {
  theme: "workspace.theme",
  demoSecret: "workspace.demo-secret",
} as const;

export type ThemePreference = "light" | "dark";

export async function loadThemePreference(): Promise<ThemePreference | null> {
  const value = await AsyncStorage.getItem(keys.theme);

  if (value === "light" || value === "dark") {
    return value;
  }

  return null;
}

export async function saveThemePreference(value: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(keys.theme, value);
}

export async function loadDemoSecret(): Promise<string | null> {
  return SecureStore.getItemAsync(keys.demoSecret);
}

export async function saveDemoSecret(secret: string): Promise<void> {
  await SecureStore.setItemAsync(keys.demoSecret, secret);
}

export async function clearDemoSecret(): Promise<void> {
  await SecureStore.deleteItemAsync(keys.demoSecret);
}
