import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, ChevronRight, Info } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { BottomSheet, SheetBlock } from "../../../shared/ui/bottom-sheet";

export type SheetAction<K extends string> = {
  key: K;
  label: string;
  description?: string;
  destructive?: boolean;
  icon?: ReactNode;
};

type ActionsSheetProps<K extends string> = {
  visible: boolean;
  title: string;
  actions: SheetAction<K>[];
  /** Called once the sheet has slid away, so the next sheet can open safely. */
  onSelect: (key: K) => void;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/**
 * List of actions in the canonical bottom sheet. The chosen action runs after
 * the close animation: iOS cannot present a new modal while one is dismissing.
 */
export function ActionsSheet<K extends string>({
  visible,
  title,
  actions,
  onSelect,
  onClose,
  theme,
  themeMode,
}: ActionsSheetProps<K>) {
  const pending = useRef<K | null>(null);
  const [open, setOpen] = useState(visible);

  useEffect(() => {
    if (visible) {
      pending.current = null;
      setOpen(true);
    }
  }, [visible]);

  return (
    <BottomSheet
      title={title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        const selected = pending.current;
        pending.current = null;
        onClose();
        if (selected) onSelect(selected);
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        contentContainerStyle={styles.actionsContent}
        showsVerticalScrollIndicator={false}
        style={styles.fullWidth}
      >
        <SheetBlock theme={theme}>
          <View style={styles.actionsGroup}>
            {actions.map((action) => (
              <ActionRow
                key={action.key}
                label={action.label}
                description={action.description}
                destructive={action.destructive}
                icon={action.icon}
                theme={theme}
                onPress={() => {
                  pending.current = action.key;
                  setOpen(false);
                }}
              />
            ))}
          </View>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

export function ActionRow({
  label,
  description,
  destructive = false,
  icon,
  onPress,
  theme,
}: {
  label: string;
  description?: string;
  destructive?: boolean;
  icon?: ReactNode;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        {
          backgroundColor: destructive
            ? theme.color.dangerSurface
            : theme.color.control,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon ? <View style={styles.actionIcon}>{icon}</View> : null}
      <View style={styles.actionText}>
        <Text
          style={[
            styles.actionLabel,
            {
              color: destructive ? theme.color.danger : theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={[
              styles.actionDescription,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {!destructive ? (
        <ChevronRight color={theme.color.mutedForeground} size={18} />
      ) : null}
    </Pressable>
  );
}

/** Informational or warning block; warnings are announced as alerts. */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  theme,
}: {
  tone?: "info" | "warning";
  title?: string;
  children?: ReactNode;
  action?: { label: string; onPress: () => void };
  theme: ThemeTokens;
}) {
  const isWarning = tone === "warning";
  const Icon = isWarning ? AlertTriangle : Info;
  return (
    <View
      accessibilityRole={isWarning ? "alert" : undefined}
      style={[
        styles.notice,
        {
          backgroundColor: isWarning
            ? theme.color.dangerSurface
            : theme.color.control,
        },
      ]}
    >
      <Icon
        color={isWarning ? theme.color.danger : theme.color.mutedForeground}
        size={18}
      />
      <View style={styles.noticeBody}>
        {title ? (
          <Text
            style={[
              styles.noticeTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {title}
          </Text>
        ) : null}
        {typeof children === "string" ? (
          <NoticeText theme={theme}>{children}</NoticeText>
        ) : (
          children
        )}
        {action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={action.onPress}
          >
            <Text
              style={[
                styles.noticeAction,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function NoticeText({
  theme,
  children,
}: {
  theme: ThemeTokens;
  children: ReactNode;
}) {
  return (
    <Text
      style={[
        styles.noticeText,
        {
          color: theme.color.mutedForeground,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      {children}
    </Text>
  );
}

export function InlineError({
  message,
  theme,
}: {
  message: string;
  theme: ThemeTokens;
}) {
  return (
    <Text
      accessibilityRole="alert"
      style={[
        styles.inlineError,
        {
          color: theme.color.danger,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      {message}
    </Text>
  );
}

export function ProgressBar({
  value,
  accessibilityLabel,
  theme,
}: {
  /** 0..1 */
  value: number;
  accessibilityLabel?: string;
  theme: ThemeTokens;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.progressTrack, { backgroundColor: theme.color.secondary }]}
    >
      <View
        style={[
          styles.progressFill,
          { width: `${percent}%`, backgroundColor: theme.color.primary },
        ]}
      />
    </View>
  );
}

/** Caption above a block: sentence case, medium weight, like the admin sidebar group labels. */
export function SectionCaption({
  text,
  theme,
}: {
  text: string;
  theme: ThemeTokens;
}) {
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.sectionCaption,
        {
          color: theme.color.foreground,
          fontFamily: theme.typography.fontFamily.sans.medium,
        },
      ]}
    >
      {text}
    </Text>
  );
}

/** Stacked full-width sheet buttons. */
export function SheetActionsColumn({ children }: { children: ReactNode }) {
  return <View style={styles.actionsColumn}>{children}</View>;
}

export const plansUiStyles = StyleSheet.create({
  sheetScroll: {
    width: "100%",
  },
  sheetContent: {
    gap: 20,
    paddingTop: 72,
    paddingBottom: 24,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  /** SheetButton fills a row by default; in a column it must keep its own height. */
  columnButton: {
    flex: 0,
    alignSelf: "stretch",
  },
  pressed: {
    opacity: 0.7,
  },
});

const styles = StyleSheet.create({
  fullWidth: {
    width: "100%",
  },
  actionsContent: {
    paddingTop: 72,
    paddingBottom: 32,
  },
  actionsGroup: {
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 24,
  },
  actionIcon: {
    width: 24,
    alignItems: "center",
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 20,
  },
  noticeBody: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  noticeAction: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  inlineError: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  sectionCaption: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.7,
  },
  actionsColumn: {
    gap: 10,
  },
  pressed: {
    opacity: 0.7,
  },
});
