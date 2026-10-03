"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type ReactElement } from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import type { PermissionGroup } from "@workspace/api-client";

import { useAuth } from "@/components/auth-provider";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { useDeleteGroup, useGroups } from "@/features/permissions/hooks/use-permissions";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/widgets/data-state";

export function GroupsTable(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { hasPermission } = useAuth();

  const page = Number(searchParams.get("page") ?? "1") || 1;
  const search = searchParams.get("search") ?? "";

  const groupsQuery = useGroups(page, 10, search || undefined);
  const deleteGroup = useDeleteGroup();

  const [searchDraft, setSearchDraft] = useState(search);
  const [groupToDelete, setGroupToDelete] = useState<PermissionGroup | null>(null);

  const navigateWithParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value.length === 0) {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      }
      router.push(`/users/groups?${nextParams.toString()}`);
    },
    [router, searchParams],
  );

  const meta = groupsQuery.data?.meta;
  const canManage = hasPermission("permissions.manage");

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          navigateWithParams({ search: searchDraft, page: undefined });
        }}
      >
        <Input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder={t("groups.searchPlaceholder")}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline" size="sm">
          {t("common.actions.search")}
        </Button>
      </form>

      {groupsQuery.isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : groupsQuery.isError ? (
        <ErrorState onRetry={() => groupsQuery.refetch()} />
      ) : groupsQuery.data && groupsQuery.data.data.length === 0 ? (
        <EmptyState
          title={search ? t("common.states.noSearchResults") : t("groups.empty")}
          description={
            search ? t("common.states.noSearchResultsDescription") : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("groups.columns.name")}</TableHead>
                <TableHead>{t("groups.columns.description")}</TableHead>
                <TableHead>{t("groups.columns.permissions")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupsQuery.data?.data.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/users/groups/${group.id}`}
                        className="font-medium hover:underline"
                      >
                        {group.name}
                      </Link>
                      {group.isSystem ? (
                        <Badge variant="outline">{t("common.system")}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.permissions?.length ?? "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" />}
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/users/groups/${group.id}`)}
                        >
                          <EyeIcon />
                          {t("common.actions.viewDetails")}
                        </DropdownMenuItem>
                        {canManage ? (
                          <DropdownMenuItem
                            onClick={() => router.push(`/users/groups/${group.id}/edit`)}
                            disabled={group.isSystem}
                          >
                            <PencilIcon />
                            {t("common.actions.edit")}
                          </DropdownMenuItem>
                        ) : null}
                        {canManage && !group.isSystem ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setGroupToDelete(group)}
                            >
                              <Trash2Icon />
                              {t("common.actions.delete")}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {meta ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.table.rowsTotal", { total: meta.total })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => navigateWithParams({ page: String(page - 1) })}
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
              onClick={() => navigateWithParams({ page: String(page + 1) })}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={groupToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGroupToDelete(null);
          }
        }}
        title={t("groups.confirmDelete.title")}
        description={t("groups.confirmDelete.description", {
          name: groupToDelete?.name ?? "",
        })}
        confirmLabel={t("common.actions.delete")}
        isPending={deleteGroup.isPending}
        onConfirm={() => {
          if (!groupToDelete) {
            return;
          }

          deleteGroup.mutate(groupToDelete.id, {
            onSuccess: () => {
              setGroupToDelete(null);
              notifySuccess(t("groups.toasts.deleted"));
            },
            onError: (error) =>
              notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
          });
        }}
      />
    </div>
  );
}
