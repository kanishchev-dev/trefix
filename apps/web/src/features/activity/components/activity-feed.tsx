"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import type { ActivityItem } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

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
            <TableCell className="text-muted-foreground break-all whitespace-normal">
              {formatChangeValue(change.from, t)}
            </TableCell>
            <TableCell className="break-all whitespace-normal">
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
  const hasChanges = Object.keys(item.changes ?? {}).length > 0;
  const href = entityHref(item);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(item.occurredAt));
  const client = [item.client?.platform, item.client?.appVersion]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start gap-4">
        <time
          dateTime={item.occurredAt}
          className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground"
        >
          {time}
        </time>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {describeActivity(item, t)}
            </span>
            {href ? (
              <Link
                href={href}
                className="text-sm underline underline-offset-4"
              >
                {t("activity.open")}
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge
              variant={item.actor.type === "admin" ? "default" : "outline"}
            >
              {describeActor(item, t)}
            </Badge>
            {showSubject && item.subject ? (
              <Link
                href={`/users/${item.subject.id}/history`}
                className="underline underline-offset-4"
              >
                {item.subject.name ?? item.subject.id}
              </Link>
            ) : null}
            <span>{t(`activity.sources.${item.source}`)}</span>
            {client ? <span>· {client}</span> : null}
            {item.ip ? <span>· {item.ip}</span> : null}
          </div>
        </div>
        {hasChanges ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
            {t("activity.changes", {
              count: Object.keys(item.changes ?? {}).length,
            })}
          </Button>
        ) : null}
      </div>
      {open ? (
        <div className="ml-16 rounded-lg border">
          <ActivityChanges item={item} />
        </div>
      ) : null}
    </li>
  );
}

/** Activity entries grouped by local day, newest first. */
export function ActivityFeed({
  items,
  showSubject = false,
}: {
  items: readonly ActivityItem[];
  showSubject?: boolean;
}): ReactElement {
  const { locale } = useI18n();
  const groups: { key: string; label: string; items: ActivityItem[] }[] = [];

  for (const item of items) {
    const key = dayKey(item.occurredAt);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = {
        key,
        label: new Intl.DateTimeFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(item.occurredAt)),
        items: [],
      };
      groups.push(group);
    }
    group.items.push(item);
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col">
          <h3 className="text-sm font-medium text-muted-foreground first-letter:uppercase">
            {group.label}
          </h3>
          <ul className="flex flex-col divide-y">
            {group.items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                showSubject={showSubject}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
