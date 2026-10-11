import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type PlanListItem } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import {
  HeaderBackButton,
  HeaderPlusButton,
  HeaderTitle,
} from "../../main/components/header";
import { useHeaderOptions } from "../../main/context/header-context";
import { PlanErrorState } from "../../plan/components/plan-error-state";
import { PlanSkeleton } from "../../plan/components/plan-skeleton";
import { PlanCard } from "../components/plan-card";
import {
  PlanCardActionsSheet,
  type PlanCardTarget,
} from "../components/plan-card-actions-sheet";
import { plansUiStyles, SectionCaption } from "../components/plans-ui";
import { usePlanCounts, usePlansList } from "../hooks/use-plans";
import { defaultSegment, type PlansSegment } from "../lib/plan-card-format";
import { usePlansNavigation } from "../plans-navigation";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  initialSegment?: PlansSegment;
  highlightPlanId?: string | null;
};

/** Segment chosen during this app session. */
let rememberedSegment: PlansSegment | null = null;

/** "My plans": the plan in progress, then drafts and history. */
export function PlansScreen({
  theme,
  themeMode,
  copy,
  language,
  initialSegment,
  highlightPlanId,
}: Props) {
  const plansCopy = copy.plans;
  const navigation = usePlansNavigation();
  const insets = useSafeAreaInsets();
  const countsQuery = usePlanCounts();
  const activeQuery = usePlansList("active");
  const [chosenSegment, setChosenSegment] = useState<PlansSegment | null>(
    initialSegment ?? rememberedSegment,
  );
  const segment = chosenSegment ?? defaultSegment(countsQuery.data);
  const listQuery = usePlansList(
    segment,
    countsQuery.isSuccess || chosenSegment !== null,
  );
  const [actionsTarget, setActionsTarget] = useState<PlanCardTarget | null>(
    null,
  );

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={navigation.back}
        />
      ),
      centerContent: <HeaderTitle theme={theme}>{plansCopy.title}</HeaderTitle>,
      rightAction: (
        <HeaderPlusButton
          theme={theme}
          themeMode={themeMode}
          onPress={navigation.openCreationMethod}
        />
      ),
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, plansCopy.title],
  );

  const activePlan = activeQuery.data?.pages[0]?.items[0] ?? null;
  const items = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  );
  const counts = countsQuery.data;

  const refreshing =
    (countsQuery.isRefetching || listQuery.isRefetching) &&
    !listQuery.isFetchingNextPage;
  const refresh = () => {
    void countsQuery.refetch();
    void activeQuery.refetch();
    void listQuery.refetch();
  };

  const selectSegment = (next: PlansSegment) => {
    rememberedSegment = next;
    setChosenSegment(next);
  };

  const isInitialLoading =
    countsQuery.isLoading || (listQuery.isLoading && items.length === 0);
  const isError = countsQuery.isError || listQuery.isError;

  const renderCard = ({ item }: { item: PlanListItem }) => (
    <PlanCard
      plan={item}
      highlighted={item.id === highlightPlanId}
      onPress={() => navigation.openPlanDetails(item.id)}
      onOpenActions={() =>
        setActionsTarget({ id: item.id, name: item.name, status: item.status })
      }
      theme={theme}
      themeMode={themeMode}
      copy={copy}
      language={language}
    />
  );

  const header = (
    <View style={styles.header}>
      {activePlan ? (
        <View style={styles.block}>
          <SectionCaption text={plansCopy.section.active} theme={theme} />
          <PlanCard
            plan={activePlan}
            onPress={navigation.openPlanTab}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={language}
          />
        </View>
      ) : null}
      <Segmented<PlansSegment>
        segments={[
          {
            label: fillTemplate(plansCopy.segment.drafts, {
              count: counts?.draft ?? 0,
            }),
            value: "draft",
          },
          {
            label: fillTemplate(plansCopy.segment.history, {
              count: counts?.history ?? 0,
            }),
            value: "history",
          },
        ]}
        value={segment}
        onChange={selectSegment}
        accessibilityLabel={plansCopy.title}
        theme={theme}
        themeMode={themeMode}
      />
    </View>
  );

  const empty = isInitialLoading ? (
    <PlanSkeleton theme={theme} themeMode={themeMode} />
  ) : isError ? (
    <PlanErrorState
      copy={copy}
      onRetry={refresh}
      theme={theme}
      themeMode={themeMode}
    />
  ) : (
    <View style={styles.empty}>
      <Text
        style={[
          plansUiStyles.bodyText,
          styles.emptyText,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {segment === "draft" ? plansCopy.empty.drafts : plansCopy.empty.history}
      </Text>
      {segment === "draft" ? (
        <SheetButton
          label={plansCopy.empty.createButton}
          onPress={navigation.openCreationMethod}
          theme={theme}
          themeMode={themeMode}
          style={plansUiStyles.columnButton}
        />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      <FlatList
        data={isError ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          listQuery.isFetchingNextPage ? (
            <ActivityIndicator
              color={theme.color.mutedForeground}
              style={styles.footer}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (listQuery.hasNextPage && !listQuery.isFetchingNextPage)
            void listQuery.fetchNextPage();
        }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 78, paddingBottom: insets.bottom + 136 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.color.mutedForeground}
            colors={[theme.color.primary]}
            progressViewOffset={insets.top + 20}
          />
        }
      />

      <PlanCardActionsSheet
        plan={actionsTarget}
        visible={actionsTarget !== null}
        onClose={() => setActionsTarget(null)}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    gap: 20,
    marginBottom: 16,
  },
  block: {
    gap: 10,
  },
  separator: {
    height: 12,
  },
  empty: {
    gap: 16,
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: "center",
  },
  footer: {
    marginTop: 16,
  },
});
