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
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";

import type { AdminUser } from "@workspace/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/widgets/data-state";
import { useDeleteUser, useUsers } from "@/features/users/hooks/use-users";
import { formatDate, useI18n } from "@/shared/i18n";
import { useAuth } from "@/components/auth-provider";

type SortField = "createdAt" | "email" | "firstName";

export function UsersTable(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();

  const page = Number(searchParams.get("page") ?? "1") || 1;
  const search = searchParams.get("search") ?? "";
  const sortBy = (searchParams.get("sortBy") as SortField | null) ?? "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "ASC" ? "ASC" : "DESC";

  const usersQuery = useUsers({
    page,
    limit: 10,
    search: search || undefined,
    sortBy,
    sortOrder,
  });
  const deleteUser = useDeleteUser();

  const [searchDraft, setSearchDraft] = useState(search);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);

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
      router.push(`/users/list?${nextParams.toString()}`);
    },
    [router, searchParams],
  );

  const onSearchSubmit = useCallback(() => {
    navigateWithParams({ search: searchDraft, page: undefined });
  }, [navigateWithParams, searchDraft]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        navigateWithParams({
          sortOrder: sortOrder === "ASC" ? "DESC" : "ASC",
        });
        return;
      }

      navigateWithParams({ sortBy: field, sortOrder: "ASC" });
    },
    [navigateWithParams, sortBy, sortOrder],
  );

  const meta = usersQuery.data?.meta;
  const canDelete = hasPermission("users.delete");

  function renderSortIcon(field: SortField) {
    if (sortBy !== field) {
      return null;
    }

    return sortOrder === "ASC" ? (
      <ChevronUpIcon className="size-3" />
    ) : (
      <ChevronDownIcon className="size-3" />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={t("users.searchPlaceholder")}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline" size="sm">
            {t("common.actions.search")}
          </Button>
        </form>
      </div>

      {usersQuery.isLoading ? (
        <TableSkeleton rows={6} columns={4} />
      ) : usersQuery.isError ? (
        <ErrorState onRetry={() => usersQuery.refetch()} />
      ) : usersQuery.data && usersQuery.data.data.length === 0 ? (
        <EmptyState
          title={search ? t("common.states.noSearchResults") : t("users.empty")}
          description={
            search ? t("common.states.noSearchResultsDescription") : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() => toggleSort("firstName")}
                  >
                    {t("users.columns.name")}
                    {renderSortIcon("firstName")}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() => toggleSort("email")}
                  >
                    {t("users.columns.email")}
                    {renderSortIcon("email")}
                  </button>
                </TableHead>
                <TableHead>{t("users.columns.emailVerified")}</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() => toggleSort("createdAt")}
                  >
                    {t("users.columns.createdAt")}
                    {renderSortIcon("createdAt")}
                  </button>
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data?.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link
                      href={`/users/${user.id}`}
                      className="font-medium hover:underline"
                    >
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {user.emailVerified ? (
                      <Badge variant="outline">
                        <CheckCircle2Icon className="size-3" />
                        {t("common.yes")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircleIcon className="size-3" />
                        {t("common.no")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.createdAt, locale)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" />
                        }
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/users/${user.id}`)}
                        >
                          <EyeIcon />
                          {t("common.actions.viewDetails")}
                        </DropdownMenuItem>
                        {hasPermission("users.update") ? (
                          <DropdownMenuItem
                            onClick={() => router.push(`/users/${user.id}/edit`)}
                          >
                            <PencilIcon />
                            {t("common.actions.edit")}
                          </DropdownMenuItem>
                        ) : null}
                        {canDelete && !user.isSystem ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setUserToDelete(user)}
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
        open={userToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUserToDelete(null);
          }
        }}
        title={t("users.confirmDelete.title")}
        description={t("users.confirmDelete.description", {
          name: userToDelete
            ? [userToDelete.firstName, userToDelete.lastName]
                .filter(Boolean)
                .join(" ") || userToDelete.email
            : "",
        })}
        confirmLabel={t("common.actions.delete")}
        isPending={deleteUser.isPending}
        onConfirm={() => {
          if (!userToDelete) {
            return;
          }

          deleteUser.mutate(userToDelete.id, {
            onSuccess: () => {
              setUserToDelete(null);
              notifySuccess(t("users.toasts.deleted"));
            },
            onError: (error) =>
              notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
          });
        }}
      />
    </div>
  );
}
