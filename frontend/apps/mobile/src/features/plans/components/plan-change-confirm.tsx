import { View, StyleSheet } from "react-native";

import { type PlanChangePreview } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { type WorkoutDescriber } from "../lib/plan-diff";
import { PlanDiffView } from "./plan-diff-view";
import {
  InlineError,
  Notice,
  plansUiStyles,
  SheetActionsColumn,
} from "./plans-ui";

type Props = {
  preview: PlanChangePreview;
  describeWorkout?: WorkoutDescriber;
  pending: boolean;
  error: string | null;
  /** The plan changed since the preview: offer to refresh and preview again. */
  conflict: boolean;
  onApply: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Diff body with Apply / Cancel; embedded in sheets that already show a form. */
export function PlanChangeConfirm({
  preview,
  describeWorkout,
  pending,
  error,
  conflict,
  onApply,
  onCancel,
  onRefresh,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const editCopy = copy.plans.edit;
  return (
    <View style={styles.root}>
      <PlanDiffView
        preview={preview}
        describeWorkout={describeWorkout}
        copy={copy}
        language={language}
        theme={theme}
      />
      {conflict ? (
        <Notice
          tone="warning"
          theme={theme}
          action={{ label: editCopy.refresh, onPress: onRefresh }}
        >
          {editCopy.conflict}
        </Notice>
      ) : null}
      {error && !conflict ? (
        <InlineError message={error} theme={theme} />
      ) : null}
      <SheetActionsColumn>
        <SheetButton
          label={editCopy.apply}
          onPress={onApply}
          pending={pending}
          disabled={conflict}
          theme={theme}
          themeMode={themeMode}
          style={plansUiStyles.columnButton}
        />
        <SheetButton
          label={editCopy.cancel}
          variant="secondary"
          onPress={onCancel}
          disabled={pending}
          theme={theme}
          themeMode={themeMode}
          style={plansUiStyles.columnButton}
        />
      </SheetActionsColumn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 20,
  },
});
