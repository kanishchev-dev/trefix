import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../../navigation/types";
import { tokens } from "@workspace/tokens";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>workspace</Text>
        <Text style={styles.title}>
          React Native, Expo and monorepo-ready by default.
        </Text>
        <Text style={styles.lede}>
          Mobile lives in apps/mobile and follows the same project rules as
          web: typed data, shared packages and secure storage for secrets.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mobile scaffold is ready</Text>
        <Text style={styles.cardText}>
          Navigation is handled with React Navigation, while async preferences
          and secrets are separated between AsyncStorage and SecureStore.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Settings")}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Open settings</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How to develop</Text>
        <Text style={styles.cardText}>
          Start the app with `pnpm --dir apps/mobile dev`, then open Android,
          iOS or web from the Expo launcher. Shared logic belongs in packages/*,
          not inside the screen tree.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How to test</Text>
        <Text style={styles.cardText}>
          Use `pnpm --dir apps/mobile typecheck` for static checks. On-device
          validation should cover navigation, theme preference and secure
          storage flows.
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
  hero: {
    gap: 12,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 4,
    textTransform: "uppercase",
    color: tokens.color.mutedForeground,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    color: tokens.color.foreground,
  },
  lede: {
    fontSize: 16,
    lineHeight: 24,
    color: tokens.color.mutedForeground,
  },
  card: {
    gap: 16,
    padding: tokens.spacing.card,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: tokens.color.foreground,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 22,
    color: tokens.color.mutedForeground,
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
    fontWeight: "600",
    color: tokens.color.primaryForeground,
  },
});
