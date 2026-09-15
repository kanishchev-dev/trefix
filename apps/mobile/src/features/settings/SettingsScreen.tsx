import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { tokens } from "@workspace/tokens";
import {
  clearDemoSecret,
  loadThemePreference,
  loadDemoSecret,
  saveDemoSecret,
  saveThemePreference,
} from "../../shared/lib/storage";

export function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [secretSaved, setSecretSaved] = useState(false);

  useEffect(() => {
    void Promise.all([loadThemePreference(), loadDemoSecret()]).then(
      ([themePreference, demoSecret]) => {
        setDarkMode(themePreference === "dark");
        setSecretSaved(Boolean(demoSecret));
      },
    );
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.text}>
          Theme preference is stored in AsyncStorage because it is not sensitive data.
        </Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Dark mode</Text>
            <Text style={styles.rowSubtitle}>Stored as a user preference</Text>
          </View>
          <Switch
            accessibilityLabel="Toggle dark mode preference"
            value={darkMode}
          onValueChange={(value) => {
            setDarkMode(value);
            void saveThemePreference(value ? "dark" : "light");
          }}
        />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Secure storage</Text>
        <Text style={styles.text}>
          Demo secret is stored in SecureStore, which is the correct place for credentials or
          tokens that must not go into AsyncStorage.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void saveDemoSecret("workspace-demo-secret");
              setSecretSaved(true);
            }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Save demo secret</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void clearDemoSecret();
              setSecretSaved(false);
            }}
            style={styles.buttonSecondary}
          >
            <Text style={styles.buttonSecondaryText}>Clear secret</Text>
          </Pressable>
        </View>

        <Text style={styles.helper}>
          {secretSaved ? "Secret stored securely." : "No demo secret stored."}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    padding: tokens.spacing.page,
    gap: 20,
    backgroundColor: tokens.color.background,
  },
  card: {
    gap: 16,
    padding: tokens.spacing.card,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "Inter_700Bold",
    color: tokens.color.foreground,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    color: tokens.color.mutedForeground,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: tokens.color.foreground,
  },
  rowSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: tokens.color.mutedForeground,
  },
  actions: {
    gap: 12,
  },
  button: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: tokens.color.primaryForeground,
  },
  buttonSecondary: {
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.color.secondary,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: tokens.color.foreground,
  },
  helper: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: tokens.color.mutedForeground,
  },
});
