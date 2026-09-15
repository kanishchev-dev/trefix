import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { type ThemeTokens } from "@workspace/tokens";

import type { RootStackParamList } from "../../navigation/types";
import { type AppStrings } from "../../shared/lib/i18n";
import { type AuthSession } from "../../shared/lib/auth";

type Props = NativeStackScreenProps<RootStackParamList, "Home"> & {
  strings: AppStrings;
  theme: ThemeTokens;
  session: AuthSession;
  onSignOut: () => Promise<void>;
};

export function HomeScreen({ strings, theme, session, onSignOut }: Props) {
  return (
    <ScrollView contentContainerStyle={[styles.root, { backgroundColor: theme.color.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={[styles.kicker, { color: theme.color.mutedForeground }]}>{strings.appName}</Text>
        <Text style={[styles.title, { color: theme.color.foreground }]}>{strings.sessionRestored}</Text>
        <Text style={[styles.lede, { color: theme.color.mutedForeground }]}>
          {strings.signedInAs} {session.user.email}
        </Text>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.color.surfaceElevated, borderColor: theme.color.border }]}>
        <Text style={[styles.cardTitle, { color: theme.color.foreground }]}>{strings.systemTheme}</Text>
        <Text style={[styles.cardText, { color: theme.color.mutedForeground }]}>{strings.systemThemeDescription}</Text>
      </View>

      <View style={[styles.panel, { backgroundColor: theme.color.surfaceElevated, borderColor: theme.color.border }]}>
        <Text style={[styles.cardTitle, { color: theme.color.foreground }]}>{strings.sessionHeading}</Text>
        <Text style={[styles.cardText, { color: theme.color.mutedForeground }]}>{strings.sessionDescription}</Text>
        <Text style={[styles.tokenLine, { color: theme.color.mutedForeground }]}>
          {strings.sessionTokenLabel}: {session.tokens.sessionId}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => void onSignOut()}
        style={({ pressed }) => [
          styles.logoutButton,
          { backgroundColor: theme.color.primary },
          pressed && styles.logoutButtonPressed,
        ]}
      >
        <Text style={[styles.logoutButtonText, { color: theme.color.primaryForeground }]}>{strings.signOut}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    padding: 24,
    gap: 18,
  },
  hero: {
    gap: 10,
    paddingVertical: 10,
  },
  kicker: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontFamily: "Inter_800ExtraBold",
  },
  lede: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  panel: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  cardText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  tokenLine: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  logoutButton: {
    alignSelf: "flex-start",
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  logoutButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  logoutButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
