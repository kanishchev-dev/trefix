import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { ThreadPrimitive } from "@assistant-ui/react-native";
import { type ThemeTokens } from "@trefix/tokens";
import { type MainCopy } from "../../../locales";
import { styles } from "../trefix-chat.styles";

export function TrefixEmptyState({
  theme,
  copy,
}: {
  theme: ThemeTokens;
  copy: MainCopy["trefix"];
}) {
  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyBadge,
          {
            borderColor: theme.color.glassBorder,
            backgroundColor: theme.color.glassBackground,
          },
        ]}
      >
        <Sparkles color={theme.color.foreground} size={18} strokeWidth={2.2} />
        <Text
          style={[
            styles.emptyBadgeLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {copy.title}
        </Text>
      </View>

      <Text
        style={[
          styles.emptyTitle,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {copy.empty.title}
      </Text>

      <Text
        style={[
          styles.emptyBody,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {copy.empty.body}
      </Text>

      <View style={styles.starterGrid}>
        {copy.starters.map((starter) => (
          <ThreadPrimitive.Suggestion
            key={starter}
            prompt={starter}
            send
            style={({ pressed }) => [
              styles.starterChip,
              {
                borderColor: theme.color.glassBorder,
                backgroundColor: pressed
                  ? theme.color.glassBackground
                  : theme.color.surfaceElevated,
              },
            ]}
          >
            <Text
              style={[
                styles.starterLabel,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {starter}
            </Text>
          </ThreadPrimitive.Suggestion>
        ))}
      </View>
    </View>
  );
}
