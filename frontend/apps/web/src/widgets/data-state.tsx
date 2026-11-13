"use client";

import type { ReactElement, ReactNode } from "react";

import { Card, CardContent } from "@trefix/ui/components/card";
import { Skeleton } from "@trefix/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@trefix/ui/components/table";
import { RefreshCcwIcon } from "lucide-react";

import { Button } from "@trefix/ui/components/button";

import { useI18n } from "@/shared/i18n";

export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}): ReactElement {
  return (
    <Table>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <TableCell key={columnIndex}>
                <Skeleton className="h-4 w-full max-w-40" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DetailSkeleton(): ReactElement {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title?: string;
  description?: string;
}): ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-10 text-center">
      <p className="text-sm font-medium">{title ?? t("common.states.empty")}</p>
      <p className="text-sm text-muted-foreground">
        {description ?? t("common.states.emptyDescription")}
      </p>
    </div>
  );
}

export function ErrorState({
  onRetry,
}: {
  onRetry?: () => void;
}): ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <p className="text-sm font-medium">{t("common.states.error")}</p>
      <p className="text-sm text-muted-foreground">
        {t("common.states.errorDescription")}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCcwIcon />
          {t("common.actions.retry")}
        </Button>
      ) : null}
    </div>
  );
}

export function InlineCard({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <Card>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
