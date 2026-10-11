import { useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { GlassView } from "expo-glass-effect";
import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react-native";
import {
  ComposerPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-native";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { type MainCopy } from "../../../locales";
import { styles } from "../trefix-chat.styles";

export type SelectedAttachment = {
  name: string;
  uri: string;
  mimeType: string;
};

export function ComposerDock({
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

export function ComposerPanel({
  theme,
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
          backgroundColor: theme.color.floating,
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

export function AttachmentPreview({
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
        <Image
          source={{ uri: attachment.uri }}
          style={[
            styles.attachmentImage,
            { backgroundColor: theme.color.iconSurface },
          ]}
        />
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
