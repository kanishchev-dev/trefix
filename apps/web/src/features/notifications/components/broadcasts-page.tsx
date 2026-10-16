"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import { Card, CardContent } from "@trefix/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import { ChevronLeftIcon, ChevronRightIcon, SendIcon } from "lucide-react";

import { BROADCAST_STATUSES, type BroadcastStatus } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { formatDate, useI18n } from "@/shared/i18n";
import { EmptyState, ErrorState, TableSkeleton } from "@/widgets/data-state";
import { OptionSelect } from "@/widgets/option-select";
import { PageHeader } from "@/widgets/page-header";

import { useBroadcasts } from "../hooks/use-notifications";
import {
  broadcastAudienceLabel,
  broadcastText,
  percent,
} from "../lib/notification-texts";
import { ComposeBroadcastDialog } from "./compose-broadcast-dialog";
import { BroadcastStatusBadge } from "./delivery-badges";

/** Notifications sent from the admin panel, with their reach. */
export function BroadcastsPage(): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const router = useRouter();
  const canSend = hasPermission("notifications.broadcasts.send");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BroadcastStatus | "all">("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const query = useBroadcasts(page, status);
  const items = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
        actions={
          canSend ? (
            <Button onClick={() => setComposeOpen(true)}>
              <SendIcon />
              {t("notifications.compose")}
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="w-48">
            <OptionSelect
              value={status}
              options={[
                { value: "all", label: t("notifications.filters.allStatuses") },
                ...BROADCAST_STATUSES.map((value) => ({
                  value,
                  label: t(`notifications.statuses.${value}`),
                })),
              ]}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
          </div>

          {query.isLoading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t("notifications.list.empty.title")}
              description={t("notifications.list.empty.description")}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("notifications.list.columns.message")}
                    </TableHead>
                    <TableHead>
                      {t("notifications.list.columns.audience")}
                    </TableHead>
                    <TableHead>
                      {t("notifications.list.columns.channels")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("notifications.list.columns.read")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("notifications.list.columns.push")}
                    </TableHead>
                    <TableHead>
                      {t("notifications.list.columns.status")}
                    </TableHead>
                    <TableHead>
                      {t("notifications.list.columns.createdAt")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const text = broadcastText(item, locale);
                    const pushTotal =
                      item.stats.push.sent +
                      item.stats.push.delivered +
                      item.stats.push.failed +
                      item.stats.push.skipped +
                      item.stats.push.pending;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-80">
                          <Link
                            href={`/notifications/${item.id}`}
                            className="flex flex-col gap-0.5 hover:underline"
                          >
                            {text.title ? (
                              <span className="truncate font-medium">
                                {text.title}
                              </span>
                            ) : null}
                            <span className="truncate text-muted-foreground">
                              {text.body}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {broadcastAudienceLabel(item, t)} ·{" "}
                          {item.recipientsCount}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.channels.length > 0
                            ? item.channels
                                .map((channel) =>
                                  t(
                                    `notifications.delivery.channels.${channel}`,
                                  ),
                                )
                                .join(", ")
                            : t("notifications.channels.none")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {percent(item.stats.read, item.recipientsCount)}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.channels.includes("push")
                            ? `${percent(item.stats.push.delivered, pushTotal)}%`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <BroadcastStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(item.createdAt, locale)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("common.table.rowsTotal", { total: meta.total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("common.pagination.page", {
                    page: meta.page,
                    totalPages: Math.max(meta.totalPages, 1),
                  })}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ComposeBroadcastDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={(broadcast) => router.push(`/notifications/${broadcast.id}`)}
      />
    </div>
  );
}
