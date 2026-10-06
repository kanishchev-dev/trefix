import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, Text } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { BottomSheet, SheetBlock, SheetButton } from "../../../shared/ui/bottom-sheet";
import { InlineError, plansUiStyles, SheetActionsColumn } from "./plans-ui";

type Props = {
  visible: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  /** Rejects to keep the sheet open with an inline error. */
  onConfirm: () => Promise<void>;
  /** Called after the sheet has slid away; `confirmed` tells whether the action succeeded. */
  onClose: (confirmed: boolean) => void;
  errorMessage: (error: unknown) => string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/** Confirmation of an irreversible plan action (cancel, delete). */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onClose,
  errorMessage,
  theme,
  themeMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setPending(false);
      setError(null);
      confirmed.current = false;
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      confirmed.current = true;
      setOpen(false);
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheet
      title={title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose(confirmed.current);
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={plansUiStyles.sheetScroll}
        contentContainerStyle={plansUiStyles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        <SheetBlock theme={theme}>
          {typeof body === "string" ? (
            <Text
              style={[
                plansUiStyles.bodyText,
                { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.regular },
              ]}
            >
              {body}
            </Text>
          ) : (
            body
          )}
        </SheetBlock>
        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}
        <SheetBlock theme={theme}>
          <SheetActionsColumn>
            <SheetButton
              label={confirmLabel}
              variant={destructive ? "destructive" : "primary"}
              onPress={() => void handleConfirm()}
              pending={pending}
              theme={theme}
              themeMode={themeMode}
              style={plansUiStyles.columnButton}
            />
            <SheetButton
              label={cancelLabel}
              variant="secondary"
              onPress={() => setOpen(false)}
              disabled={pending}
              theme={theme}
              themeMode={themeMode}
              style={plansUiStyles.columnButton}
            />
          </SheetActionsColumn>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}
