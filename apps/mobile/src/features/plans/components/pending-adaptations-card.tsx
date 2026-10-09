import { StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type PendingAdaptation } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { useRealtimeEvent } from "../../../lib/realtime";
import { listPendingAdaptations, resolveAdaptation } from "../../../lib/training-api";
import { pluralize, type AppLanguage, type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { IconCircle } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";

type Props = {
  copy: MainCopy;
  language: AppLanguage;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

const QUERY_KEY = ["plans", "active", "adaptations"] as const;

/** Plan changes the coach proposed ("with confirmation") or only advised ("advice only"). */
export function PendingAdaptationsCard({ copy, language, theme, themeMode }: Props) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data = [] } = useQuery({ queryKey: QUERY_KEY, queryFn: listPendingAdaptations });
  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "apply" | "dismiss" }) => resolveAdaptation(id, action),
    onSuccess: (_result, { action }) => {
      if (action === "apply") showToast(copy.plans.pendingAdaptations.applied);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
      void queryClient.invalidateQueries({ queryKey: ["plan"] });
    },
  });
  useRealtimeEvent("plan.adaptation.proposed", () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  });

  if (data.length === 0) return null;
  const t = copy.plans.pendingAdaptations;

  return (
    <View style={styles.stack}>
      {data.map((adaptation) => (
        <AdaptationItem
          key={adaptation.id}
          adaptation={adaptation}
          title={adaptation.status === "suggested" ? t.suggestedTitle : t.proposedTitle}
          action={(t.actions as Record<string, string>)[adaptation.type] ?? t.actions.default}
          count={changesCount(adaptation)}
          countLabel={(count) => pluralize(t.workouts, count, language)}
          pending={resolve.isPending}
          onApply={adaptation.status === "proposed" ? () => resolve.mutate({ id: adaptation.id, action: "apply" }) : undefined}
          onDismiss={() => resolve.mutate({ id: adaptation.id, action: "dismiss" })}
          dismissLabel={adaptation.status === "suggested" ? t.ok : t.dismiss}
          applyLabel={t.apply}
          theme={theme}
          themeMode={themeMode}
        />
      ))}
    </View>
  );
}

function changesCount(adaptation: PendingAdaptation): number {
  const changes = adaptation.decision?.changes;
  return Array.isArray(changes) ? changes.length : 0;
}

function AdaptationItem({
  title,
  action,
  count,
  countLabel,
  pending,
  onApply,
  onDismiss,
  applyLabel,
  dismissLabel,
  theme,
  themeMode,
}: {
  adaptation: PendingAdaptation;
  title: string;
  action: string;
  count: number;
  countLabel: (count: number) => string;
  pending: boolean;
  onApply?: () => void;
  onDismiss: () => void;
  applyLabel: string;
  dismissLabel: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }]}>
      <View style={styles.head}>
        <IconCircle theme={theme}>
          <Sparkles color={theme.color.foreground} size={20} />
        </IconCircle>
        <View style={styles.texts}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.description, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {count > 0 ? `${action} · ${countLabel(count)}` : action}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {onApply ? (
          <SheetButton label={applyLabel} onPress={onApply} disabled={pending} theme={theme} themeMode={themeMode} style={styles.button} />
        ) : null}
        <SheetButton
          label={dismissLabel}
          variant="secondary"
          onPress={onDismiss}
          disabled={pending}
          theme={theme}
          themeMode={themeMode}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  texts: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
  },
});
