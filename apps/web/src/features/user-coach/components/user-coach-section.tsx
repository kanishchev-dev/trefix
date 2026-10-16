"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
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
import { cn } from "@trefix/ui/lib/utils";
import { EyeIcon, LockIcon, Trash2Icon } from "lucide-react";

import type { CoachSessionDetail } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import {
  clearUserCoachHistory,
  fetchUserCoachNotes,
  fetchUserCoachSession,
  fetchUserCoachSessions,
} from "@/entities/user-coach/api";
import {
  userCardKeys,
  useUserCardMutation,
} from "@/features/users/hooks/use-user-card-query";
import { formatDate, useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { DetailSkeleton, EmptyState, ErrorState } from "@/widgets/data-state";

const SECTION = "coach";

type Message = CoachSessionDetail["messages"][number];

function MessageBubble({ message }: { message: Message }): ReactElement {
  const { t, locale } = useI18n();

  if (message.role === "tool") {
    return (
      <details className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          {t("userCard.coach.toolCall", { tool: message.toolName ?? "tool" })}
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
          {message.content}
        </pre>
      </details>
    );
  }

  const fromUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        fromUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
          fromUser ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {message.content}
      </div>
      <span className="text-xs text-muted-foreground">
        {t(`userCard.coach.roles.${message.role}`)} ·{" "}
        {formatDate(message.createdAt, locale)}
      </span>
    </div>
  );
}

function Conversation({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}): ReactElement {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: [...userCardKeys.section(userId, SECTION), "session", sessionId],
    queryFn: () => fetchUserCoachSession(userId, sessionId),
  });

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <EyeIcon className="size-3.5" />
        {t("userCard.coach.accessLogged")}
      </p>
      {query.data.session.summary ? (
        <p className="rounded-lg border p-3 text-sm text-muted-foreground">
          {query.data.session.summary}
        </p>
      ) : null}
      {query.data.messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

export function UserCoachSection({ userId }: { userId: string }): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const canReadConversations = hasPermission("coach.conversations.read");
  const canManage = hasPermission("coach.users.manage");
  const [selected, setSelected] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const sessions = useQuery({
    queryKey: [...userCardKeys.section(userId, SECTION), "sessions"],
    queryFn: () => fetchUserCoachSessions(userId),
  });
  const notes = useQuery({
    queryKey: [...userCardKeys.section(userId, SECTION), "notes"],
    queryFn: () => fetchUserCoachNotes(userId),
  });
  const clear = useUserCardMutation(userId, {
    mutationFn: () => clearUserCoachHistory(userId),
    sections: [SECTION],
    successMessage: t("userCard.coach.toasts.cleared"),
    onSuccess: () => setSelected(null),
  });

  const items = sessions.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("userCard.coach.sessionsTitle")}</CardTitle>
          <CardDescription>
            {canReadConversations
              ? t("userCard.coach.sessionsDescription")
              : t("userCard.coach.noConversationAccess")}
          </CardDescription>
          {canManage && items.length > 0 ? (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearOpen(true)}
              >
                <Trash2Icon />
                {t("userCard.coach.clear")}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {sessions.isLoading ? (
            <DetailSkeleton />
          ) : sessions.isError ? (
            <ErrorState onRetry={() => sessions.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t("userCard.coach.empty.title")}
              description={t("userCard.coach.empty.description")}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
              <ul className="flex flex-col gap-1">
                {items.map((session) => (
                  <li key={session.id}>
                    <button
                      type="button"
                      disabled={!canReadConversations}
                      onClick={() => setSelected(session.id)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-sm transition-colors enabled:hover:bg-muted disabled:cursor-default",
                        selected === session.id && "bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {!canReadConversations ? (
                          <LockIcon className="size-3.5 shrink-0" />
                        ) : null}
                        <span className="truncate">
                          {session.title ?? t("userCard.coach.untitled")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(
                          session.lastMessageAt ?? session.createdAt,
                          locale,
                        )}{" "}
                        ·{" "}
                        {t("userCard.coach.messages", {
                          count: session.messagesCount,
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-w-0 rounded-xl border p-4">
                {selected && canReadConversations ? (
                  <Conversation userId={userId} sessionId={selected} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {canReadConversations
                      ? t("userCard.coach.pickSession")
                      : t("userCard.coach.noConversationAccess")}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("userCard.coach.notesTitle")}</CardTitle>
          <CardDescription>
            {t("userCard.coach.notesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notes.isLoading ? (
            <DetailSkeleton />
          ) : (notes.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("userCard.coach.noNotes")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {notes.data?.items.map((note) => (
                <li
                  key={`${note.workoutId}-${note.language}`}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <Link
                    href={`/users/${userId}/workouts/${note.workoutId}`}
                    className="underline underline-offset-4"
                  >
                    {t("userCard.coach.noteFor", {
                      date: formatDate(note.generatedAt, locale),
                    })}
                  </Link>
                  <Badge variant="outline">{note.language}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t("userCard.coach.clearTitle")}
        description={t("userCard.coach.clearDescription")}
        confirmLabel={t("userCard.coach.clear")}
        isPending={clear.isPending}
        onConfirm={() =>
          clear.mutate(undefined, { onSuccess: () => setClearOpen(false) })
        }
      />
    </div>
  );
}
