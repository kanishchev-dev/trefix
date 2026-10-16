"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@trefix/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@trefix/ui/components/avatar";
import { Button } from "@trefix/ui/components/button";
import {
  BanIcon,
  InfoIcon,
  PencilIcon,
  RotateCcwIcon,
  SendIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";

import type { AdminUserDetail } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { toInitials } from "@/entities/avatar/lib/initials";
import { BlockUserDialog } from "@/features/user-account/components/block-user-dialog";
import { useAccountActions } from "@/features/user-account/hooks/use-user-account";
import { displayNameOf } from "@/features/users/context/user-card-context";
import { useInviteUser } from "@/features/users/hooks/use-users";
import { useUserPresence } from "@/features/users/hooks/use-user-presence";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { formatDate, useI18n } from "@/shared/i18n";
import { AvatarPresenceDot } from "@/widgets/avatar-presence-dot";
import { ConfirmDialog } from "@/widgets/confirm-dialog";

import { UserStatusBadge } from "./user-status-badge";

/** Header of a user's card: identity, status and the account-wide actions. */
export function UserCardHeader({
  user,
}: {
  user: AdminUserDetail;
}): ReactElement {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const actions = useAccountActions(user.id);
  const inviteUser = useInviteUser();

  const [blockOpen, setBlockOpen] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const displayName = displayNameOf(user);
  const { isOnline } = useUserPresence([user.id]);
  const online = isOnline(user.id);

  const isDeleted = user.status === "deleted";
  const isBlocked = user.status === "blocked";
  const canManageSecurity =
    hasPermission("users.security.manage") && !user.isSystem;
  const canUpdate = hasPermission("users.update") && !isDeleted;
  const canInvite =
    hasPermission("users.manage") && !user.passwordChangedAt && !isDeleted;
  const canDelete =
    canManageSecurity && hasPermission("users.delete") && !isDeleted;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative shrink-0">
            <Avatar className="size-14">
              <AvatarImage
                src={user.avatarUrl ?? undefined}
                alt={displayName}
              />
              <AvatarFallback>{toInitials(displayName)}</AvatarFallback>
            </Avatar>
            <AvatarPresenceDot
              online={online}
              className="size-3"
              label={t("presence.online")}
            />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-medium tracking-tight">
              <span className="truncate">{displayName}</span>
              <UserStatusBadge status={user.status} />
              {online ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {t("presence.online")}
                </span>
              ) : null}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUpdate ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/users/${user.id}/edit`)}
            >
              <PencilIcon />
              {t("common.actions.edit")}
            </Button>
          ) : null}
          {canInvite ? (
            <Button
              variant="outline"
              size="sm"
              disabled={inviteUser.isPending}
              onClick={() =>
                inviteUser.mutate(user.id, {
                  onSuccess: () => notifySuccess(t("users.toasts.invited")),
                  onError: (error) =>
                    notifyError(
                      t("common.states.error"),
                      getFriendlyApiMessage(error, t),
                    ),
                })
              }
            >
              <SendIcon />
              {t("users.actions.invite")}
            </Button>
          ) : null}
          {canManageSecurity && !isDeleted ? (
            isBlocked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnblockOpen(true)}
              >
                <ShieldCheckIcon />
                {t("userCard.actions.unblock")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBlockOpen(true)}
              >
                <BanIcon />
                {t("userCard.actions.block")}
              </Button>
            )
          ) : null}
          {canDelete ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
              {t("common.actions.delete")}
            </Button>
          ) : null}
        </div>
      </div>

      {user.isSystem ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4" />
          {t("users.system")}
        </p>
      ) : null}

      {isBlocked ? (
        <Alert variant="destructive">
          <BanIcon />
          <AlertTitle>
            {user.blockedUntil
              ? t("userCard.banner.blockedUntil", {
                  date: formatDate(user.blockedUntil, locale),
                })
              : t("userCard.banner.blocked")}
          </AlertTitle>
          <AlertDescription>
            {t("userCard.banner.blockedDetails", {
              date: formatDate(user.blockedAt, locale),
              reason: user.blockedReason
                ? t(`userCard.blockReasons.${user.blockedReason}`)
                : "—",
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      {isDeleted ? (
        <Alert>
          <Trash2Icon />
          <AlertTitle>{t("userCard.banner.deleted")}</AlertTitle>
          <AlertDescription>
            {t("userCard.banner.deletedDetails", {
              date: formatDate(user.deletedAt, locale),
            })}
          </AlertDescription>
          {canManageSecurity ? (
            <AlertAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreOpen(true)}
              >
                <RotateCcwIcon />
                {t("userCard.actions.restore")}
              </Button>
            </AlertAction>
          ) : null}
        </Alert>
      ) : null}

      <BlockUserDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        userName={displayName}
        isPending={actions.block.isPending}
        onSubmit={(input) =>
          actions.block.mutate(input, { onSuccess: () => setBlockOpen(false) })
        }
      />
      <ConfirmDialog
        open={unblockOpen}
        onOpenChange={setUnblockOpen}
        destructive={false}
        title={t("userCard.unblock.title")}
        description={t("userCard.unblock.description", { name: displayName })}
        confirmLabel={t("userCard.actions.unblock")}
        isPending={actions.unblock.isPending}
        onConfirm={() =>
          actions.unblock.mutate(undefined, {
            onSuccess: () => setUnblockOpen(false),
          })
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("users.confirmDelete.title")}
        description={t("userCard.delete.description", { name: displayName })}
        confirmLabel={t("common.actions.delete")}
        isPending={actions.requestDeletion.isPending}
        onConfirm={() =>
          actions.requestDeletion.mutate(undefined, {
            onSuccess: () => setDeleteOpen(false),
          })
        }
      />
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        destructive={false}
        title={t("userCard.restore.title")}
        description={t("userCard.restore.description", { name: displayName })}
        confirmLabel={t("userCard.actions.restore")}
        isPending={actions.restore.isPending}
        onConfirm={() =>
          actions.restore.mutate(undefined, {
            onSuccess: () => setRestoreOpen(false),
          })
        }
      />
    </div>
  );
}
