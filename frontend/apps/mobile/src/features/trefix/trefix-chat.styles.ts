import { StyleSheet } from "react-native";
import { type ThemeTokens } from "@trefix/tokens";

export function createMarkdownStyles(theme: ThemeTokens) {
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
      fontFamily: theme.typography.fontFamily.sans.medium,
      marginTop: 8,
      marginBottom: 10,
    },
    heading2: {
      color: theme.color.foreground,
      fontFamily: theme.typography.fontFamily.sans.medium,
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

export const styles = StyleSheet.create({
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
    width: "100%",
    gap: 8,
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
    borderRadius: 9999,
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
    borderRadius: 9999,
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
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
});
