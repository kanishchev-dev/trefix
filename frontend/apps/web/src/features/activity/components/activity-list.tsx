"use client";

import type {
  InfiniteData,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";
import type { ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import { Spinner } from "@trefix/ui/components/spinner";

import type { ActivityPage } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";
import { EmptyState, ErrorState, TableSkeleton } from "@/widgets/data-state";

import { ActivityFeed } from "./activity-feed";

/** Paged activity feed with loading, empty and error states. */
export function ActivityList({
  query,
  showSubject = false,
}: {
  query: UseInfiniteQueryResult<InfiniteData<ActivityPage>>;
  showSubject?: boolean;
}): ReactElement {
  const { t } = useI18n();

  if (query.isLoading) return <TableSkeleton rows={6} columns={3} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title={t("activity.empty.title")}
        description={t("activity.empty.description")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ActivityFeed items={items} showSubject={showSubject} />
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? <Spinner /> : null}
          {t("activity.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
