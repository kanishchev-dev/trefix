import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  PLAN_NAME_MAX_LENGTH,
  PLAN_NOTES_MAX_LENGTH,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import { GlassInput } from "../../../shared/ui/glass-input";
import { planErrorMessage } from "../lib/plan-errors";
import { InlineError, plansUiStyles } from "./plans-ui";

type Props = {
  visible: boolean;
  initialName: string;
  initialNotes: string | null | undefined;
  /** Persists the values; rejects to keep the sheet open with an error. */
  onSubmit: (values: {
    name: string;
    notes: string | null;
  }) => Promise<void> | void;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

/** Plan name (1..80) and free-form notes (≤ 2000); available for a plan in any status. */
export function PlanMetaSheet({
  visible,
  initialName,
  initialNotes,
  onSubmit,
  onClose,
  theme,
  themeMode,
  copy,
}: Props) {
  const metaCopy = copy.plans.meta;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setOpen(true);
    setName(initialName);
    setNotes(initialNotes ?? "");
    setNameError(null);
    setError(null);
    setPending(false);
  }, [initialName, initialNotes, visible]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(metaCopy.nameRequired);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({ name: trimmed, notes: notes.trim() ? notes : null });
      setOpen(false);
    } catch (submitError) {
      setError(planErrorMessage(submitError, copy, metaCopy.failed));
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheet
      title={metaCopy.title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={plansUiStyles.sheetScroll}
        contentContainerStyle={plansUiStyles.sheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetBlock theme={theme}>
          <View style={styles.fields}>
            <GlassInput
              theme={theme}
              label={metaCopy.name}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(null);
              }}
              placeholder={metaCopy.namePlaceholder}
              maxLength={PLAN_NAME_MAX_LENGTH}
              error={nameError ?? undefined}
              returnKeyType="next"
            />
            <GlassInput
              theme={theme}
              label={metaCopy.notes}
              value={notes}
              onChangeText={setNotes}
              placeholder={metaCopy.notesPlaceholder}
              maxLength={PLAN_NOTES_MAX_LENGTH}
              multiline
              style={styles.notesInput}
            />
            <Text
              style={[
                styles.counter,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {fillTemplate(metaCopy.counter, {
                count: notes.length,
                max: PLAN_NOTES_MAX_LENGTH,
              })}
            </Text>
          </View>
        </SheetBlock>
        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}
        <SheetBlock theme={theme}>
          <SheetButton
            label={metaCopy.save}
            onPress={() => void handleSave()}
            pending={pending}
            theme={theme}
            themeMode={themeMode}
            style={plansUiStyles.columnButton}
          />
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: 12,
  },
  notesInput: {
    height: 140,
    paddingTop: 16,
    paddingBottom: 16,
    textAlignVertical: "top",
  },
  counter: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
  },
});
