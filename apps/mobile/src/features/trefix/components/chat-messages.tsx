import { Text, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { MessagePrimitive, useAuiState } from "@assistant-ui/react-native";
import { type ThemeTokens } from "@workspace/tokens";
import { styles, createMarkdownStyles } from "../trefix-chat.styles";

export function UserMessage({ theme }: { theme: ThemeTokens }) {
  return (
    <MessagePrimitive.Root style={styles.messageRoot}>
      <View
        style={[
          styles.messageRow,
          styles.userRow,
          {
            backgroundColor: theme.color.primary,
            borderColor: theme.color.primary,
          },
        ]}
      >
        <MessagePrimitive.Content
          renderText={({ part }) => (
            <Text
              style={[
                styles.messageText,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {part.text}
            </Text>
          )}
        />
      </View>
    </MessagePrimitive.Root>
  );
}

export function AssistantMessage({ theme }: { theme: ThemeTokens }) {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isLast = useAuiState((state) => state.message.isLast);

  return (
    <MessagePrimitive.Root style={styles.messageRoot}>
      <View style={styles.assistantRow}>
        <View style={styles.messageHeader}>
          {isRunning && isLast ? (
            <View
              style={[
                styles.typingPill,
                { backgroundColor: theme.color.glassBackground },
              ]}
            >
              <View
                style={[
                  styles.typingDot,
                  { backgroundColor: theme.color.mutedForeground },
                ]}
              />
              <View
                style={[
                  styles.typingDot,
                  { backgroundColor: theme.color.mutedForeground },
                ]}
              />
              <View
                style={[
                  styles.typingDot,
                  { backgroundColor: theme.color.mutedForeground },
                ]}
              />
            </View>
          ) : null}
        </View>

        <MessagePrimitive.Content
          renderText={({ part }) => (
            <Markdown style={createMarkdownStyles(theme)}>{part.text}</Markdown>
          )}
        />
      </View>
    </MessagePrimitive.Root>
  );
}
