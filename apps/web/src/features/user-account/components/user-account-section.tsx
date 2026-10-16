"use client";

import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button, buttonVariants } from "@trefix/ui/components/button";
import { ButtonGroup } from "@trefix/ui/components/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@trefix/ui/components/item";
import {
  DownloadIcon,
  KeyRoundIcon,
  KeySquareIcon,
  LogOutIcon,
  MailCheckIcon,
  MailIcon,
  MonitorIcon,
  SmartphoneIcon,
  UnlinkIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { userAccountPaths } from "@/entities/user-account/api";
import { DetailRow } from "@/features/users/components/card/detail-row";
import { UserStatusBadge } from "@/features/users/components/card/user-status-badge";
import { formatDate, useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import {
  DetailSkeleton,
  ErrorState,
  TableSkeleton,
} from "@/widgets/data-state";

import {
  useAccountActions,
  useAccountSecurity,
  useUserConsents,
  useUserDataExports,
  useUserIdentities,
  useUserSessions,
} from "../hooks/use-user-account";
import { AccountPreferencesCard } from "./account-preferences-card";
import { ChangeEmailDialog } from "./change-email-dialog";

const isMobile = (platform: string | null): boolean =>
  platform !== null && /ios|android/i.test(platform);

type Confirm =
  | { kind: "revokeAll" }
  | { kind: "revoke"; sessionId: string }
  | { kind: "unlink"; provider: string }
  | { kind: "passwordReset" }
  | { kind: "verifyEmail" };

function SecurityCard({
  userId,
  canManage,
  onConfirm,
}: {
  userId: string;
  canManage: boolean;
  onConfirm: (confirm: Confirm) => void;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useAccountSecurity(userId);
  const { changeEmail } = useAccountActions(userId);
  const [emailOpen, setEmailOpen] = useState(false);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  const security = query.data;
  const manageable =
    canManage && !security.isSystem && security.status !== "deleted";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.account.security.title")}</CardTitle>
        <CardDescription>
          {t("userCard.account.security.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-x-8 md:grid-cols-2">
          <DetailRow
            label={t("userCard.account.security.status")}
            value={<UserStatusBadge status={security.status} showActive />}
          />
          <DetailRow
            label={t("users.fields.email")}
            value={
              <span className="flex flex-wrap items-center gap-2">
                <span className="break-all">{security.email}</span>
                <Badge
                  variant={security.emailVerified ? "outline" : "secondary"}
                >
                  {security.emailVerified
                    ? t("users.email.verified")
                    : t("users.email.notVerified")}
                </Badge>
              </span>
            }
          />
          <DetailRow
            label={t("userCard.account.security.password")}
            value={
              security.hasPassword
                ? t("userCard.account.security.passwordChanged", {
                    date: formatDate(security.passwordChangedAt, locale),
                  })
                : t("userCard.account.security.noPassword")
            }
          />
          <DetailRow
            label={t("users.fields.emailVerifiedAt")}
            value={formatDate(security.emailVerifiedAt, locale)}
          />
          {security.block ? (
            <>
              <DetailRow
                label={t("userCard.account.security.blockReason")}
                value={
                  security.block.reason
                    ? t(`userCard.blockReasons.${security.block.reason}`)
                    : "—"
                }
              />
              <DetailRow
                label={t("userCard.account.security.blockUntil")}
                value={
                  security.block.until
                    ? formatDate(security.block.until, locale)
                    : t("userCard.block.durations.permanent")
                }
              />
              <DetailRow
                label={t("userCard.account.security.blockedBy")}
                value={`${security.block.by?.name ?? "—"} · ${formatDate(security.block.at, locale)}`}
              />
              <DetailRow
                label={t("userCard.block.comment")}
                value={security.block.comment ?? "—"}
              />
            </>
          ) : null}
          {security.deletion ? (
            <DetailRow
              label={t("userCard.account.security.purgeAt")}
              value={formatDate(security.deletion.purgeAt, locale)}
            />
          ) : null}
        </div>
        {manageable ? (
          <ButtonGroup>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmailOpen(true)}
            >
              <MailIcon />
              {t("userCard.account.actions.changeEmail")}
            </Button>
            {!security.emailVerified ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onConfirm({ kind: "verifyEmail" })}
              >
                <MailCheckIcon />
                {t("userCard.account.actions.verifyEmail")}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfirm({ kind: "passwordReset" })}
            >
              <KeyRoundIcon />
              {t("userCard.account.actions.passwordReset")}
            </Button>
          </ButtonGroup>
        ) : null}
      </CardContent>
      <ChangeEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        currentEmail={security.email}
        isPending={changeEmail.isPending}
        onSubmit={(email) =>
          changeEmail.mutate(email, { onSuccess: () => setEmailOpen(false) })
        }
      />
    </Card>
  );
}

function SessionsCard({
  userId,
  canManage,
  onConfirm,
}: {
  userId: string;
  canManage: boolean;
  onConfirm: (confirm: Confirm) => void;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useUserSessions(userId);
  const sessions = query.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.account.sessions.title")}</CardTitle>
        <CardDescription>
          {t("userCard.account.sessions.description")}
        </CardDescription>
        {canManage && sessions.length > 0 ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onConfirm({ kind: "revokeAll" })}
            >
              <LogOutIcon />
              {t("userCard.account.actions.revokeAll")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("userCard.account.sessions.empty")}
          </p>
        ) : (
          <ItemGroup className="gap-2">
            {sessions.map((session) => {
              const DeviceIcon = isMobile(session.platform)
                ? SmartphoneIcon
                : MonitorIcon;
              const place = [session.city, session.country]
                .filter(Boolean)
                .join(", ");
              return (
                <Item key={session.id} variant="outline" size="sm">
                  <ItemMedia variant="icon">
                    <DeviceIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {session.deviceName ??
                        session.platform ??
                        t("userCard.account.sessions.unknownDevice")}
                      {session.appVersion ? (
                        <Badge variant="outline">{session.appVersion}</Badge>
                      ) : null}
                    </ItemTitle>
                    <ItemDescription>
                      {[
                        place,
                        t("userCard.account.sessions.activeAt", {
                          date: formatDate(session.lastActiveAt, locale),
                        }),
                        t("userCard.account.sessions.signedInAt", {
                          date: formatDate(session.createdAt, locale),
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                  </ItemContent>
                  {canManage ? (
                    <ItemActions>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("userCard.account.actions.revoke")}
                        onClick={() =>
                          onConfirm({ kind: "revoke", sessionId: session.id })
                        }
                      >
                        <LogOutIcon />
                      </Button>
                    </ItemActions>
                  ) : null}
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}

function IdentitiesCard({
  userId,
  canManage,
  onConfirm,
}: {
  userId: string;
  canManage: boolean;
  onConfirm: (confirm: Confirm) => void;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useUserIdentities(userId);
  const identities = query.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.account.identities.title")}</CardTitle>
        <CardDescription>
          {t("userCard.account.identities.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={2} columns={3} />
        ) : identities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("userCard.account.identities.empty")}
          </p>
        ) : (
          <ItemGroup className="gap-2">
            {identities.map((identity) => (
              <Item key={identity.provider} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <KeySquareIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {t(`userCard.providers.${identity.provider}`)}
                  </ItemTitle>
                  <ItemDescription>
                    {[identity.email, formatDate(identity.linkedAt, locale)]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
                {canManage ? (
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("userCard.account.actions.unlink")}
                      onClick={() =>
                        onConfirm({
                          kind: "unlink",
                          provider: identity.provider,
                        })
                      }
                    >
                      <UnlinkIcon />
                    </Button>
                  </ItemActions>
                ) : null}
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}

function PrivacyCard({ userId }: { userId: string }): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const consents = useUserConsents(userId);
  const exports = useUserDataExports(userId);
  const { requestDataExport } = useAccountActions(userId);
  const canManage = hasPermission("users.security.manage");
  const latest = exports.data?.[0];
  const exportBlocked =
    latest !== undefined && new Date(latest.nextAvailableAt) > new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.account.privacy.title")}</CardTitle>
        <CardDescription>
          {t("userCard.account.privacy.description")}
        </CardDescription>
        {canManage ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={exportBlocked || requestDataExport.isPending}
              onClick={() => requestDataExport.mutate(undefined)}
            >
              {t("userCard.account.actions.requestExport")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {t("userCard.account.privacy.consents")}
          </span>
          {(consents.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("userCard.account.privacy.noConsents")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {consents.data?.items.map((consent) => (
                <li
                  key={`${consent.type}-${consent.version}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {t(`userCard.account.privacy.consentTypes.${consent.type}`)}{" "}
                    · {consent.version}
                  </span>
                  <span className="text-muted-foreground">
                    {consent.revokedAt
                      ? t("userCard.account.privacy.revoked", {
                          date: formatDate(consent.revokedAt, locale),
                        })
                      : t("userCard.account.privacy.accepted", {
                          date: formatDate(consent.acceptedAt, locale),
                        })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {t("userCard.account.privacy.exports")}
          </span>
          {(exports.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("userCard.account.privacy.noExports")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {exports.data?.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {formatDate(item.requestedAt, locale)} ·{" "}
                    {t(
                      `userCard.account.privacy.exportStatuses.${item.status}`,
                    )}
                  </span>
                  {item.status === "ready" ? (
                    <a
                      href={userAccountPaths.dataExportDownload(
                        userId,
                        item.id,
                      )}
                      download
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      <DownloadIcon />
                      {t("userCard.account.actions.download")}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function UserAccountSection({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const actions = useAccountActions(userId);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const canManage = hasPermission("users.security.manage");

  const close = () => setConfirm(null);
  const options = { onSuccess: close };
  const run = () => {
    if (!confirm) return;
    switch (confirm.kind) {
      case "revokeAll":
        return actions.revokeAllSessions.mutate(undefined, options);
      case "revoke":
        return actions.revokeSession.mutate(confirm.sessionId, options);
      case "unlink":
        return actions.unlinkIdentity.mutate(confirm.provider, options);
      case "passwordReset":
        return actions.sendPasswordReset.mutate(undefined, options);
      case "verifyEmail":
        return actions.verifyEmail.mutate(undefined, options);
    }
  };
  const isPending =
    actions.revokeAllSessions.isPending ||
    actions.revokeSession.isPending ||
    actions.unlinkIdentity.isPending ||
    actions.sendPasswordReset.isPending ||
    actions.verifyEmail.isPending;
  const destructive =
    confirm?.kind === "revokeAll" ||
    confirm?.kind === "revoke" ||
    confirm?.kind === "unlink";

  return (
    <div className="flex flex-col gap-4">
      <SecurityCard
        userId={userId}
        canManage={canManage}
        onConfirm={setConfirm}
      />
      <SessionsCard
        userId={userId}
        canManage={canManage}
        onConfirm={setConfirm}
      />
      <IdentitiesCard
        userId={userId}
        canManage={canManage}
        onConfirm={setConfirm}
      />
      <AccountPreferencesCard userId={userId} />
      <PrivacyCard userId={userId} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && close()}
        destructive={destructive}
        title={
          confirm ? t(`userCard.account.confirm.${confirm.kind}.title`) : ""
        }
        description={
          confirm
            ? t(`userCard.account.confirm.${confirm.kind}.description`)
            : ""
        }
        isPending={isPending}
        onConfirm={run}
      />
    </div>
  );
}
