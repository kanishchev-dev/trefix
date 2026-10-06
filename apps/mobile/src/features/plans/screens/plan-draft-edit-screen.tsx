import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { useToast } from "../../../shared/ui/toast";
import { PlanPreviewScreen } from "../../plan-creation/plan-preview-screen";
import { toDraftWeekOverrides } from "../../plan-creation/preview-edits";
import { usePlanDetails, useUpdateDraftStructure } from "../hooks/use-plan";
import { draftFromConfig, relativeWeeksOf, relativeWeeksToPreview } from "../lib/plan-draft";

type Props = {
  planId: string;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Workouts of a stored draft in the plan preview editor; saved with the draft version. */
export function PlanDraftEditScreen({ planId, onClose, theme, themeMode, copy, language }: Props) {
  const detailsQuery = usePlanDetails(planId);
  const updateStructure = useUpdateDraftStructure();
  const { showToast } = useToast();
  const details = detailsQuery.data;

  const view = useMemo(() => {
    if (!details) return null;
    return {
      preview: relativeWeeksToPreview(relativeWeeksOf(details), details),
      draft: draftFromConfig(details.config),
    };
  }, [details]);

  if (!details || !view) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.color.background }]}>
        <ActivityIndicator color={theme.color.foreground} />
      </View>
    );
  }

  return (
    <PlanPreviewScreen
      theme={theme}
      themeMode={themeMode}
      copy={copy}
      language={language}
      mode="draft-edit"
      preview={view.preview}
      draft={view.draft}
      onDiscard={onClose}
      onSubmit={async ({ edits }) => {
        await updateStructure.mutateAsync({
          planId,
          expectedVersion: details.version,
          weekOverrides: toDraftWeekOverrides(edits) ?? [],
        });
      }}
      onCompleted={() => {
        showToast(copy.plans.preview.changesSaved);
        onClose();
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
