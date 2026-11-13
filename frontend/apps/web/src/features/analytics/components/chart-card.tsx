"use client";

import type { ReactElement, ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Skeleton } from "@trefix/ui/components/skeleton";
import { cn } from "@trefix/ui/lib/utils";
import { ChartNoAxesColumnIcon } from "lucide-react";

import { useI18n } from "@/shared/i18n";

/**
 * Card around one chart or block of the dashboard: a title, a one-line
 * conclusion from the data and the chart. Shows a skeleton while loading
 * and an explanation when there is nothing to draw yet.
 */
export function ChartCard({
  title,
  description,
  action,
  footer,
  loading,
  empty,
  emptyHint,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyHint?: string;
  className?: string;
  children?: ReactNode;
}): ReactElement {
  const { t } = useI18n();
  return (
    <Card className={cn("@container/chart min-w-0", className)}>
      <CardHeader>
        <CardTitle className="truncate font-medium">{title}</CardTitle>
        {loading ? (
          <Skeleton className="h-4 w-2/3" />
        ) : description ? (
          <CardDescription className="truncate">{description}</CardDescription>
        ) : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : empty ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <ChartNoAxesColumnIcon className="size-5" />
            <span>{t("analytics.empty.title")}</span>
            {emptyHint ? <span className="text-xs">{emptyHint}</span> : null}
          </div>
        ) : (
          children
        )}
      </CardContent>
      {footer && !loading && !empty ? (
        <CardFooter className="flex-col items-start gap-1 text-sm">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

/** Row of headline numbers inside a card. */
export function StatRow({
  items,
  className,
}: {
  items: readonly { label: string; value: ReactNode }[];
  className?: string;
}): ReactElement {
  return (
    <div className={cn("flex flex-wrap gap-x-8 gap-y-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col">
          <span className="text-2xl font-medium whitespace-nowrap tabular-nums">
            {item.value}
          </span>
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
