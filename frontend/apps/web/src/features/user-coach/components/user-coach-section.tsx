"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Fragment, useState, type ReactElement } from "react";

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
import { Avatar, AvatarFallback } from "@trefix/ui/components/avatar";
import { Bubble, BubbleContent } from "@trefix/ui/components/bubble";
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
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@trefix/ui/components/marker";
import {
  Message as ChatRow,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "@trefix/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@trefix/ui/components/message-scroller";
import {
  ChevronRightIcon,
  EyeIcon,
  LockIcon,
  MessagesSquareIcon,
  NotebookPenIcon,
  ScrollTextIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";

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

function dayKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function ToolCall({ message }: { message: Message }): ReactElement {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Marker
        variant="border"
        render={
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          />
        }
        className="cursor-pointer text-left hover:text-foreground"
      >
        <MarkerIcon>
          <WrenchIcon />
        </MarkerIcon>
        <MarkerContent>
          {t("userCard.coach.toolCall", { tool: message.toolName ?? "tool" })}
        </MarkerContent>
      </Marker>
      {open ? (
        <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-3 text-xs break-all whitespace-pre-wrap">
          {message.content}
        </pre>
      ) : null}
    </div>
  );
}

function ChatMessage({ message }: { message: Message }): ReactElement {
  const { locale } = useI18n();
  const fromUser = message.role === "user";
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(message.createdAt));

  return (
    <ChatRow align={fromUser ? "end" : "start"}>
      {!fromUser ? (
        <MessageAvatar>
          <Avatar className="size-7">
            <AvatarFallback>
              <SparklesIcon className="size-3.5" />
            </AvatarFallback>
          </Avatar>
        </MessageAvatar>
      ) : null}
      <MessageContent>
        <Bubble
          variant={fromUser ? "default" : "muted"}
          align={fromUser ? "end" : "start"}
        >
          <BubbleContent className="whitespace-pre-wrap">
            {message.content}
          </BubbleContent>
        </Bubble>
        <MessageFooter className="text-xs text-muted-foreground tabular-nums">
          {time}
        </MessageFooter>
      </MessageContent>
    </ChatRow>
  );
}

function Conversation({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useQuery({
    queryKey: [...userCardKeys.section(userId, SECTION), "session", sessionId],
    queryFn: () => fetchUserCoachSession(userId, sessionId),
  });

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  const messages = query.data.messages;
  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  });

  return (
    <MessageScrollerProvider defaultScrollPosition="end">
      <MessageScroller className="h-[32rem]">
        <MessageScrollerViewport>
          <MessageScrollerContent className="gap-4 p-4">
            <MessageScrollerItem messageId="access-note">
              <Marker role="status" className="justify-center">
                <MarkerIcon>
                  <EyeIcon />
                </MarkerIcon>
                <MarkerContent>
                  {t("userCard.coach.accessLogged")}
                </MarkerContent>
              </Marker>
            </MessageScrollerItem>
            {query.data.session.summary ? (
              <MessageScrollerItem messageId="summary">
                <Marker variant="border">
                  <MarkerIcon>
                    <ScrollTextIcon />
                  </MarkerIcon>
                  <MarkerContent>{query.data.session.summary}</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ) : null}
            {messages.map((message, index) => {
              const newDay =
                index === 0 ||
                dayKey(messages[index - 1].createdAt) !==
                  dayKey(message.createdAt);
              return (
                <Fragment key={message.id}>
                  {newDay ? (
                    <MessageScrollerItem messageId={`day-${message.id}`}>
                      <Marker variant="separator">
                        <MarkerContent>
                          {dayFormat.format(new Date(message.createdAt))}
                        </MarkerContent>
                      </Marker>
                    </MessageScrollerItem>
                  ) : null}
                  <MessageScrollerItem
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    {message.role === "tool" ? (
                      <ToolCall message={message} />
                    ) : (
                      <ChatMessage message={message} />
                    )}
                  </MessageScrollerItem>
                </Fragment>
              );
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
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
              <ItemGroup className="gap-1">
                {items.map((session) => (
                  <Item
                    key={session.id}
                    size="sm"
                    variant={selected === session.id ? "muted" : "default"}
                    render={
                      <button
                        type="button"
                        disabled={!canReadConversations}
                        onClick={() => setSelected(session.id)}
                      />
                    }
                    className="text-left enabled:hover:bg-muted disabled:cursor-default"
                  >
                    <ItemMedia variant="icon">
                      {canReadConversations ? (
                        <MessagesSquareIcon />
                      ) : (
                        <LockIcon />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="line-clamp-1">
                        {session.title ?? t("userCard.coach.untitled")}
                      </ItemTitle>
                      <ItemDescription>
                        {formatDate(
                          session.lastMessageAt ?? session.createdAt,
                          locale,
                        )}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Badge variant="outline" className="tabular-nums">
                        {session.messagesCount}
                      </Badge>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
              <div className="min-w-0 overflow-hidden rounded-2xl border">
                {selected && canReadConversations ? (
                  <Conversation userId={userId} sessionId={selected} />
                ) : (
                  <p className="flex h-[32rem] items-center justify-center p-4 text-sm text-muted-foreground">
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
            <ItemGroup className="gap-1">
              {notes.data?.items.map((note) => (
                <Item
                  key={`${note.workoutId}-${note.language}`}
                  size="sm"
                  render={
                    <Link
                      href={`/users/${userId}/workouts/${note.workoutId}`}
                    />
                  }
                >
                  <ItemMedia variant="icon">
                    <NotebookPenIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {t("userCard.coach.noteFor", {
                        date: formatDate(note.generatedAt, locale),
                      })}
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant="outline">{note.language}</Badge>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
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
