import { useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { GlassView } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import {
  ArrowUp,
  FileText,
  Paperclip,
  Square,
  Sparkles,
  X,
} from "lucide-react-native";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import {
  Header,
  HeaderBackButton,
  HeaderLogo,
} from "../main/components/header";
import { useTrefixRuntime } from "./use-trefix-runtime";
import { type MainCopy } from "../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy["trefix"];
  onBack: () => void;
};

type SelectedAttachment = {
  name: string;
  uri: string;
  mimeType: string;
};

export function TrefixChatScreen({ theme, themeMode, copy, onBack }: Props) {
  const runtime = useTrefixRuntime();
  const logoSource =
    themeMode === "dark"
      ? require("../../../assets/trefix-logo-light.png")
      : require("../../../assets/trefix-logo-dark.png");

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <Header
        leftAction={
          <HeaderBackButton
            theme={theme}
            themeMode={themeMode}
            onPress={onBack}
          />
        }
        centerContent={<HeaderLogo source={logoSource} />}
        theme={theme}
        themeMode={themeMode}
      />

      <AssistantRuntimeProvider runtime={runtime}>
        <ChatSurface theme={theme} themeMode={themeMode} copy={copy} />
      </AssistantRuntimeProvider>
    </View>
  );
}

function ChatSurface({
  theme,
  themeMode,
  copy,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy["trefix"];
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardShell}
    >
      <ThreadPrimitive.Root style={styles.threadRoot}>
        <ThreadPrimitive.MessagesFlatList
          autoScroll
          contentContainerStyle={[
            styles.messagesContent,
            {
              paddingTop: 116 + insets.top,
              paddingBottom: 128 + Math.max(insets.bottom, 8),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <TrefixEmptyState theme={theme} copy={copy} />
          }
        >
          {({ message }) =>
            message.role === "user" ? (
              <UserMessage theme={theme} />
            ) : (
              <AssistantMessage theme={theme} />
            )
          }
        </ThreadPrimitive.MessagesFlatList>

        <ComposerDock
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          bottomOffset={Math.max(insets.bottom - 12, 0)}
        />
      </ThreadPrimitive.Root>
    </KeyboardAvoidingView>
  );
}

function TrefixEmptyState({
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
            fontFamily: theme.typography.fontFamily.sans.extrabold,
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

function UserMessage({ theme }: { theme: ThemeTokens }) {
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

function AssistantMessage({ theme }: { theme: ThemeTokens }) {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const isLast = useAuiState((state) => state.message.isLast);

  return (
    <MessagePrimitive.Root style={styles.messageRoot}>
      <View
        style={[
          styles.messageRow,
          styles.assistantRow,
          {
            borderColor: theme.color.glassBorder,
            backgroundColor: theme.color.surfaceElevated,
          },
        ]}
      >
        <View style={styles.messageHeader}>
          {isRunning && isLast ? (
            <View
              style={[
                styles.typingPill,
                { backgroundColor: theme.color.glassBackground },
              ]}
            >
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
              <View style={styles.typingDot} />
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

function ComposerDock({
  theme,
  themeMode,
  copy,
  bottomOffset,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy["trefix"];
  bottomOffset: number;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.composerDock,
        {
          bottom: bottomOffset,
        },
      ]}
    >
      <ComposerPrimitive.Root style={styles.composerRoot}>
        <ComposerPanel theme={theme} themeMode={themeMode} copy={copy} />
      </ComposerPrimitive.Root>
    </View>
  );
}

function ComposerPanel({
  theme,
  themeMode,
  copy,
}: {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy["trefix"];
}) {
  const aui = useAui();
  const canSend = useAuiState((state) => state.composer.canSend);
  const isRunning = useAuiState((state) => state.thread.isRunning);
  const [attachment, setAttachment] = useState<SelectedAttachment | null>(null);

  const attachmentKind = useMemo(() => {
    if (!attachment) return null;
    return attachment.mimeType.startsWith("image/") ? "image" : "file";
  }, [attachment]);

  async function handlePickAttachment() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        "image/*",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset) {
      return;
    }

    setAttachment({
      name: asset.name ?? "attachment",
      uri: asset.uri,
      mimeType: asset.mimeType ?? "application/octet-stream",
    });
  }

  async function handleSend() {
    if (!canSend) {
      return;
    }

    await Promise.resolve(aui.composer.send());
    setAttachment(null);
  }

  return (
    <GlassView
      glassEffectStyle="regular"
      isInteractive
      tintColor={theme.color.glassTint}
      style={[
        styles.composerGlass,
        {
          borderColor: theme.color.glassBorder,
          backgroundColor:
            themeMode === "dark"
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.78)",
        },
      ]}
    >
      {attachment ? (
        <AttachmentPreview
          attachment={attachment}
          kind={attachmentKind ?? "file"}
          theme={theme}
          onRemove={() => setAttachment(null)}
        />
      ) : null}

      <View style={styles.composerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Attach file"
          onPress={handlePickAttachment}
          style={({ pressed }) => [
            styles.iconButton,
            {
              borderColor: theme.color.glassBorder,
              backgroundColor: pressed
                ? theme.color.glassBackground
                : "transparent",
            },
          ]}
        >
          <Paperclip
            color={theme.color.foreground}
            size={18}
            strokeWidth={2.2}
          />
        </Pressable>

        <View style={styles.inputWrap}>
          <ComposerPrimitive.Input
            multiline
            placeholder={copy.composerPlaceholder}
            placeholderTextColor={theme.color.mutedForeground}
            submitMode="none"
            style={[
              styles.input,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          />
        </View>

        {isRunning ? (
          <ComposerPrimitive.Cancel
            accessibilityLabel="Stop generation"
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: pressed
                  ? theme.color.glassBackground
                  : theme.color.primary,
              },
            ]}
          >
            <Square
              color={theme.color.primaryForeground}
              size={18}
              strokeWidth={2.2}
            />
          </ComposerPrimitive.Cancel>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!canSend}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: canSend
                  ? theme.color.primary
                  : theme.color.overlay,
                opacity: pressed && canSend ? 0.92 : 1,
              },
            ]}
          >
            <ArrowUp
              color={theme.color.primaryForeground}
              size={18}
              strokeWidth={2.4}
            />
          </Pressable>
        )}
      </View>
    </GlassView>
  );
}

function AttachmentPreview({
  attachment,
  kind,
  theme,
  onRemove,
}: {
  attachment: SelectedAttachment;
  kind: "image" | "file";
  theme: ThemeTokens;
  onRemove: () => void;
}) {
  return (
    <View
      style={[
        styles.attachmentCard,
        {
          borderColor: theme.color.glassBorder,
          backgroundColor: theme.color.glassBackground,
        },
      ]}
    >
      {kind === "image" ? (
        <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
      ) : (
        <View
          style={[
            styles.attachmentIcon,
            {
              borderColor: theme.color.glassBorder,
              backgroundColor: theme.color.surfaceElevated,
            },
          ]}
        >
          <FileText color={theme.color.foreground} size={18} strokeWidth={2} />
        </View>
      )}

      <View style={styles.attachmentText}>
        <Text
          numberOfLines={1}
          style={[
            styles.attachmentName,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {attachment.name}
        </Text>
        <Text
          style={[
            styles.attachmentMeta,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {kind === "image" ? "Image" : attachment.mimeType}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove attachment"
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeButton,
          {
            backgroundColor: pressed
              ? theme.color.glassBackground
              : "transparent",
          },
        ]}
      >
        <X color={theme.color.foreground} size={16} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function createMarkdownStyles(theme: ThemeTokens) {
  return {
    body: {
      color: theme.color.foreground,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: theme.typography.fontFamily.sans.regular,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 10,
    },
    heading1: {
      color: theme.color.foreground,
      fontFamily: theme.typography.fontFamily.sans.extrabold,
      marginTop: 8,
      marginBottom: 10,
    },
    heading2: {
      color: theme.color.foreground,
      fontFamily: theme.typography.fontFamily.sans.bold,
      marginTop: 8,
      marginBottom: 8,
    },
    strong: {
      fontFamily: theme.typography.fontFamily.sans.semibold,
    },
    em: {
      fontStyle: "italic" as const,
    },
    code_inline: {
      backgroundColor: theme.color.overlay,
      color: theme.color.foreground,
      fontFamily: theme.typography.fontFamily.mono,
      borderRadius: 8,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    code_block: {
      backgroundColor: theme.color.overlay,
      color: theme.color.foreground,
      fontFamily: theme.typography.fontFamily.mono,
      borderRadius: 16,
      padding: 14,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: theme.color.overlay,
      color: theme.color.foreground,
      fontFamily: theme.typography.fontFamily.mono,
      borderRadius: 16,
      padding: 14,
      marginVertical: 8,
    },
    link: {
      color: theme.color.accent,
      textDecorationLine: "underline" as const,
    },
    bullet_list: {
      marginBottom: 10,
    },
    ordered_list: {
      marginBottom: 10,
    },
    list_item: {
      marginBottom: 4,
    },
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.glassBorder,
      borderRadius: 14,
      marginVertical: 8,
    },
    th: {
      padding: 8,
      color: theme.color.foreground,
      backgroundColor: theme.color.glassBackground,
      fontFamily: theme.typography.fontFamily.sans.semibold,
    },
    td: {
      padding: 8,
      color: theme.color.foreground,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.glassBorder,
    },
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  keyboardShell: {
    flex: 1,
  },
  threadRoot: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  emptyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyBadgeLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    textAlign: "center",
    maxWidth: 320,
  },
  emptyBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
  },
  starterGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 8,
  },
  starterChip: {
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  starterLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageRoot: {
    marginBottom: 14,
  },
  messageRow: {
    maxWidth: "88%",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  userRow: {
    alignSelf: "flex-end",
  },
  assistantRow: {
    alignSelf: "flex-start",
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  typingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    marginLeft: "auto",
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#8f8f95",
  },
  composerDock: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: -6,
  },
  composerRoot: {
    width: "100%",
  },
  composerGlass: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 10,
    overflow: "hidden",
  },
  attachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  attachmentImage: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  attachmentIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentText: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    fontSize: 14,
    lineHeight: 18,
  },
  attachmentMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 1,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    paddingHorizontal: 4,
  },
  input: {
    minHeight: 42,
    maxHeight: 128,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
});
