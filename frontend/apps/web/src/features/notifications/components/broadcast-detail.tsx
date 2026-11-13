"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Checkbox } from "@trefix/ui/components/checkbox";
import { Field, FieldLabel } from "@trefix/ui/components/field";
import { Progress } from "@trefix/ui/components/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import type { Broadcast } from "@trefix/api-client";

import { formatDate, useI18n } from "@/shared/i18n";
import {
  DetailSkeleton,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/widgets/data-state";
import { PageHeader } from "@/widgets/page-header";

import {
  useBroadcast,
  useBroadcastRecipients,
} from "../hooks/use-notifications";
import {
  broadcastAudienceLabel,
  linkLabel,
  percent,
} from "../lib/notification-texts";
import { BroadcastStatusBadge, DeliveryBadges } from "./delivery-badges";

type ChannelStats = Broadcast["stats"]["push"];

function channelTotal(stats: ChannelStats): number {
  return (
    stats.pending + stats.sent + stats.delivered + stats.failed + stats.skipped
  );
}

function Stat({
  label,
  value,
  share,
  hint,
}: {
  label: string;
  value: string;
  share?: number;
  hint?: string;
}): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-medium tabular-nums">{value}</span>
      {share !== undefined ? <Progress value={share} /> : null}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

function ChannelStat({
  label,
  stats,
  enabled,
}: {
  label: string;
  stats: ChannelStats;
  enabled: boolean;
}): ReactElement {
  const { t } = useI18n();
  if (!enabled) {
    return (
      <Stat label={label} value="—" hint={t("notifications.channels.none")} />
    );
  }
  const total = channelTotal(stats);
  const reached = stats.delivered + stats.sent;
  const parts = (["delivered", "sent", "pending", "skipped", "failed"] as const)
    .filter((status) => stats[status] > 0)
    .map(
      (status) =>
        `${t(`notifications.delivery.statuses.${status}`)}: ${stats[status]}`,
    )
    .join(" · ");
  return (
    <Stat
      label={label}
      value={`${percent(reached, total)}%`}
      share={percent(reached, total)}
      hint={parts || undefined}
    />
  );
}

function Recipients({ broadcastId }: { broadcastId: string }): ReactElement {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const query = useBroadcastRecipients(broadcastId, page, unread);
  const items = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications.detail.recipients")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field orientation="horizontal">
          <Checkbox
            id="recipients-unread"
            checked={unread}
            onCheckedChange={(checked) => {
              setUnread(checked === true);
              setPage(1);
            }}
          />
          <FieldLabel htmlFor="recipients-unread" className="font-normal">
            {t("notifications.detail.onlyUnread")}
          </FieldLabel>
        </Field>
        {query.isLoading ? (
          <TableSkeleton rows={5} columns={3} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={t("notifications.detail.noRecipients")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("notifications.detail.recipients")}</TableHead>
                  <TableHead>{t("notifications.detail.read")}</TableHead>
                  <TableHead>
                    {t("notifications.list.columns.channels")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.notificationId}>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/users/${item.user.id}/notifications`}
                        className="hover:underline"
                      >
                        {item.user.name || item.user.id}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {item.readAt
                        ? formatDate(item.readAt, locale)
                        : t("notifications.user.unread")}
                    </TableCell>
                    <TableCell>
                      <DeliveryBadges deliveries={item.deliveries} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2">
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
        ) : null}
      </CardContent>
    </Card>
  );
}

/** One broadcast: what was sent, to whom, and how it was delivered. */
export function BroadcastDetail({ id }: { id: string }): ReactElement {
  const { t, locale } = useI18n();
  const query = useBroadcast(id);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }
  const broadcast = query.data;
  const languages = (["ru", "en"] as const).filter(
    (language) => broadcast.content[language],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("notifications.detail.title")}
        description={`${broadcastAudienceLabel(broadcast, t)} · ${formatDate(broadcast.createdAt, locale)}`}
        actions={<BroadcastStatusBadge status={broadcast.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("notifications.detail.stats")}</CardTitle>
          {broadcast.error ? (
            <CardDescription className="text-destructive">
              {broadcast.error}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t("notifications.detail.recipientsTotal")}
            value={String(broadcast.recipientsCount)}
          />
          <Stat
            label={t("notifications.detail.read")}
            value={`${percent(broadcast.stats.read, broadcast.recipientsCount)}%`}
            share={percent(broadcast.stats.read, broadcast.recipientsCount)}
            hint={String(broadcast.stats.read)}
          />
          <ChannelStat
            label={t("notifications.detail.push")}
            stats={broadcast.stats.push}
            enabled={broadcast.channels.includes("push")}
          />
          <ChannelStat
            label={t("notifications.detail.email")}
            stats={broadcast.stats.email}
            enabled={broadcast.channels.includes("email")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("notifications.detail.content")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {languages.map((language) => {
            const text = broadcast.content[language];
            return text ? (
              <div key={language} className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">
                  {t(`notifications.content.languages.${language}`)}
                </span>
                {text.title ? (
                  <span className="font-medium">{text.title}</span>
                ) : null}
                <p className="text-sm whitespace-pre-wrap">{text.body}</p>
              </div>
            ) : null;
          })}
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">
              {t("notifications.detail.link")}
            </dt>
            <dd className="break-all">{linkLabel(broadcast.link, t)}</dd>
            <dt className="text-muted-foreground">
              {t("notifications.channels.label")}
            </dt>
            <dd>
              {broadcast.channels.length > 0
                ? broadcast.channels
                    .map((channel) =>
                      t(`notifications.delivery.channels.${channel}`),
                    )
                    .join(", ")
                : t("notifications.channels.none")}
            </dd>
            <dt className="text-muted-foreground">
              {t("notifications.detail.author")}
            </dt>
            <dd>
              {broadcast.createdBy ? (
                <Link
                  href={`/users/${broadcast.createdBy.id}`}
                  className="hover:underline"
                >
                  {broadcast.createdBy.name}
                </Link>
              ) : (
                t("notifications.detail.system")
              )}
            </dd>
            <dt className="text-muted-foreground">
              {t("notifications.detail.completedAt")}
            </dt>
            <dd>{formatDate(broadcast.completedAt, locale)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Recipients broadcastId={broadcast.id} />
    </div>
  );
}
