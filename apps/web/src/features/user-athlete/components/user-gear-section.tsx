"use client";

import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trefix/ui/components/dropdown-menu";
import { Progress } from "@trefix/ui/components/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@trefix/ui/components/tabs";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import type { Gear } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { NoAthlete } from "@/features/users/components/card/no-athlete";
import { isNotFound } from "@/features/users/lib/card-errors";
import { formatKm } from "@/features/users/lib/card-format";
import { useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/widgets/data-state";

import { useGearActions, useUserGear } from "../hooks/use-user-athlete";
import { GearFormDialog } from "./gear-form-dialog";

type Status = "active" | "retired";
type FormState = { gear: Gear | null } | null;

export function UserGearSection({ userId }: { userId: string }): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const [status, setStatus] = useState<Status>("active");
  const query = useUserGear(userId, status);
  const actions = useGearActions(userId);
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<Gear | null>(null);
  const canManage = hasPermission("training.usergear.manage");

  if (isNotFound(query.error)) return <NoAthlete />;

  const items = query.data?.items ?? [];
  const nameOf = (gear: Gear) =>
    gear.nickname || `${gear.brand} ${gear.model}`.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.gear.title")}</CardTitle>
        <CardDescription>{t("userCard.gear.description")}</CardDescription>
        {canManage ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForm({ gear: null })}
            >
              <PlusIcon />
              {t("userCard.gear.add")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <TabsList>
            <TabsTrigger value="active">
              {t("userCard.gear.statuses.active")}
            </TabsTrigger>
            <TabsTrigger value="retired">
              {t("userCard.gear.statuses.retired")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {query.isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={t("userCard.gear.empty.title")}
            description={t("userCard.gear.empty.description")}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("userCard.gear.columns.name")}</TableHead>
                <TableHead>{t("userCard.gear.columns.type")}</TableHead>
                <TableHead>{t("userCard.gear.columns.distance")}</TableHead>
                <TableHead>{t("userCard.gear.columns.wear")}</TableHead>
                <TableHead>{t("userCard.gear.columns.workouts")}</TableHead>
                {canManage ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((gear) => (
                <TableRow key={gear.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{nameOf(gear)}</span>
                      <div className="flex flex-wrap gap-1">
                        {gear.nickname ? (
                          <span className="text-xs text-muted-foreground">
                            {gear.brand} {gear.model}
                          </span>
                        ) : null}
                        {gear.isDefault ? (
                          <Badge variant="outline">
                            {t("userCard.gear.default")}
                          </Badge>
                        ) : null}
                        {gear.replaceSoon ? (
                          <Badge variant="destructive">
                            {t("userCard.gear.replaceSoon")}
                          </Badge>
                        ) : null}
                        {gear.source !== "manual" ? (
                          <Badge variant="secondary">
                            {t(`userCard.providers.${gear.source}`)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{t(`userCard.gear.types.${gear.type}`)}</TableCell>
                  <TableCell className="tabular-nums">
                    {gear.limitKm
                      ? t("userCard.gear.distanceOfLimit", {
                          distance: formatKm(gear.distanceKm, locale),
                          limit: formatKm(gear.limitKm, locale),
                        })
                      : t("userCard.overview.km", {
                          value: formatKm(gear.distanceKm, locale),
                        })}
                  </TableCell>
                  <TableCell className="w-40">
                    {gear.wearPercent !== null ? (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(100, gear.wearPercent)}
                          className="flex-1"
                        />
                        <span className="text-xs tabular-nums">
                          {gear.wearPercent}%
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {gear.workoutsCount}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("common.table.actions")}
                            />
                          }
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setForm({ gear })}>
                            <PencilIcon />
                            {t("common.actions.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              actions.setArchived.mutate({
                                gearId: gear.id,
                                archived: gear.status === "active",
                              })
                            }
                          >
                            {gear.status === "active" ? (
                              <ArchiveIcon />
                            ) : (
                              <ArchiveRestoreIcon />
                            )}
                            {gear.status === "active"
                              ? t("userCard.gear.retire")
                              : t("userCard.gear.restore")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleting(gear)}
                          >
                            <Trash2Icon />
                            {t("common.actions.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <GearFormDialog
        gear={form?.gear ?? null}
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        isPending={actions.create.isPending || actions.update.isPending}
        onSubmit={(input) => {
          const onSuccess = () => setForm(null);
          if (form?.gear) {
            actions.update.mutate(
              { gearId: form.gear.id, input },
              { onSuccess },
            );
          } else {
            actions.create.mutate(input, { onSuccess });
          }
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("userCard.gear.deleteTitle")}
        description={t("userCard.gear.deleteDescription", {
          name: deleting ? nameOf(deleting) : "",
        })}
        confirmLabel={t("common.actions.delete")}
        isPending={actions.remove.isPending}
        onConfirm={() =>
          deleting &&
          actions.remove.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          })
        }
      />
    </Card>
  );
}
