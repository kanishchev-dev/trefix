"use client";

import Link from "next/link";
import { Fragment, useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@trefix/ui/components/item";
import { Marker, MarkerContent } from "@trefix/ui/components/marker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import { ArrowUpRightIcon, ChevronDownIcon } from "lucide-react";

import type { ActivityItem } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

import { ACTIVITY_DOMAIN_ICONS } from "../lib/activity-icons";
import {
  describeActivity,
  describeActor,
  entityHref,
  fieldLabel,
  formatChangeValue,
} from "../lib/activity-texts";

function dayKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function ActivityChanges({ item }: { item: ActivityItem }): ReactElement {
  const { t } = useI18n();
  const entries = Object.entries(item.changes ?? {});

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("activity.diff.field")}</TableHead>
          <TableHead>{t("activity.diff.before")}</TableHead>
          <TableHead>{t("activity.diff.after")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(([field, change]) => (
          <TableRow key={field}>
            <TableCell className="font-medium">
              {fieldLabel(field, t)}
            </TableCell>
            <TableCell className="whitespace-normal break-all text-muted-foreground line-through decoration-muted-foreground/40">
              {formatChangeValue(change.from, t)}
            </TableCell>
            <TableCell className="whitespace-normal break-all">
              {formatChangeValue(change.to, t)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ActivityRow({
  item,
  showSubject,
}: {
  item: ActivityItem;
  showSubject: boolean;
}): ReactElement {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const changeCount = Object.keys(item.changes ?? {}).length;
  const href = entityHref(item);
  const Icon = ACTIVITY_DOMAIN_ICONS[item.domain];
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(item.occurredAt));
  const client = [item.client?.platform, item.client?.appVersion]
    .filter(Boolean)
    .join(" ");
  const meta = [time, t(`activity.sources.${item.source}`), client, item.ip]
    .filter(Boolean)
    .join(" · ");

  return (
    <Item size="sm" variant={item.actor.type === "admin" ? "muted" : "default"}>
      <ItemMedia
        variant="icon"
        className="size-8 rounded-full border bg-background"
      >
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="flex-wrap">
          {describeActivity(item, t)}
          <Badge variant={item.actor.type === "admin" ? "default" : "outline"}>
            {describeActor(item, t)}
          </Badge>
          {showSubject && item.subject ? (
            <Link
              href={`/users/${item.subject.id}/history`}
              className="font-normal text-muted-foreground underline underline-offset-4"
            >
              {item.subject.name ?? item.subject.id}
            </Link>
          ) : null}
        </ItemTitle>
        <ItemDescription className="tabular-nums">{meta}</ItemDescription>
      </ItemContent>
      {changeCount > 0 || href ? (
        <ItemActions>
          {changeCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {t("activity.changes", { count: changeCount })}
              <ChevronDownIcon
                data-icon="inline-end"
                className={
                  open
                    ? "rotate-180 transition-transform"
                    : "transition-transform"
                }
              />
            </Button>
          ) : null}
          {href ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("activity.open")}
              render={<Link href={href} />}
              nativeButton={false}
            >
              <ArrowUpRightIcon />
            </Button>
          ) : null}
        </ItemActions>
      ) : null}
      {open ? (
        <ItemFooter className="basis-full">
          <div className="w-full rounded-xl border bg-background">
            <ActivityChanges item={item} />
          </div>
        </ItemFooter>
      ) : null}
    </Item>
  );
}

/** Activity entries newest first, split by local day with a labeled separator. */
export function ActivityFeed({
  items,
  showSubject = false,
}: {
  items: readonly ActivityItem[];
  showSubject?: boolean;
}): ReactElement {
  const { locale } = useI18n();
  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <ItemGroup className="gap-1">
      {items.map((item, index) => {
        const newDay =
          index === 0 ||
          dayKey(items[index - 1].occurredAt) !== dayKey(item.occurredAt);
        return (
          <Fragment key={item.id}>
            {newDay ? (
              <Marker
                variant="separator"
                className={index > 0 ? "mt-4" : undefined}
              >
                <MarkerContent className="first-letter:uppercase">
                  {dayFormat.format(new Date(item.occurredAt))}
                </MarkerContent>
              </Marker>
            ) : null}
            <ActivityRow item={item} showSubject={showSubject} />
          </Fragment>
        );
      })}
    </ItemGroup>
  );
}
