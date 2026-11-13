"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import { Checkbox } from "@trefix/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trefix/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@trefix/ui/components/tabs";
import { Textarea } from "@trefix/ui/components/textarea";

import {
  BROADCAST_LIMITS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LINK_TARGETS,
  type Broadcast,
  type CreateBroadcastInput,
  type NotificationChannel,
  type NotificationLinkTarget,
} from "@trefix/api-client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { OptionSelect } from "@/widgets/option-select";

import {
  useAudiencePreview,
  useCreateBroadcast,
} from "../hooks/use-notifications";
import {
  AudienceEditor,
  EMPTY_AUDIENCE,
  toAudience,
  type AudienceState,
} from "./audience-editor";

type Language = "ru" | "en";
type LinkTarget = NotificationLinkTarget | "none";
type Text = { title: string; body: string };

/** Targets that point at one object and accept its id. */
const TARGETS_WITH_ID: readonly LinkTarget[] = ["coach", "workout", "plan"];
const EMPTY_TEXT: Record<Language, Text> = {
  ru: { title: "", body: "" },
  en: { title: "", body: "" },
};

/**
 * Composes an admin notification. With `user` the audience is that one user
 * and the audience picker is hidden (user card).
 */
export function ComposeBroadcastDialog({
  open,
  onOpenChange,
  user,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: { id: string; name: string };
  onSent?: (broadcast: Broadcast) => void;
}): ReactElement {
  const { t, locale } = useI18n();
  const create = useCreateBroadcast();
  const [audience, setAudience] = useState<AudienceState>(EMPTY_AUDIENCE);
  const [language, setLanguage] = useState<Language>(
    locale === "en" ? "en" : "ru",
  );
  const [texts, setTexts] = useState(EMPTY_TEXT);
  const [target, setTarget] = useState<LinkTarget>("none");
  const [linkId, setLinkId] = useState("");
  const [url, setUrl] = useState("");
  const [channels, setChannels] = useState<NotificationChannel[]>(["push"]);
  const [errors, setErrors] = useState<{
    content?: boolean;
    url?: boolean;
    audience?: boolean;
  }>({});
  const [confirming, setConfirming] = useState(false);

  // Every opening starts from a blank form.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAudience(EMPTY_AUDIENCE);
      setLanguage(locale === "en" ? "en" : "ru");
      setTexts(EMPTY_TEXT);
      setTarget("none");
      setLinkId("");
      setUrl("");
      setChannels(["push"]);
      setErrors({});
      setConfirming(false);
    }
  }

  const apiAudience = user
    ? { type: "users" as const, userIds: [user.id] }
    : toAudience(audience);
  const debouncedAudience = useDebouncedValue(apiAudience, 400);
  const preview = useAudiencePreview(user || !open ? null : debouncedAudience);
  const recipients = user ? 1 : (preview.data?.recipients ?? 0);

  const buildInput = (): CreateBroadcastInput | null => {
    const content: CreateBroadcastInput["content"] = {};
    for (const key of ["ru", "en"] as const) {
      const body = texts[key].body.trim();
      if (body) {
        content[key] = { title: texts[key].title.trim() || null, body };
      }
    }
    const nextErrors = {
      content: Object.keys(content).length === 0,
      url: target === "url" && !/^https:\/\/\S+$/.test(url.trim()),
      audience: apiAudience === null,
    };
    setErrors(nextErrors);
    if (
      nextErrors.content ||
      nextErrors.url ||
      nextErrors.audience ||
      !apiAudience
    ) {
      return null;
    }
    return {
      audience: apiAudience,
      content,
      link:
        target === "none"
          ? null
          : {
              target,
              id:
                TARGETS_WITH_ID.includes(target) && linkId.trim()
                  ? linkId.trim()
                  : null,
              url: target === "url" ? url.trim() : null,
            },
      channels,
    };
  };

  const send = (input: CreateBroadcastInput) => {
    create.mutate(input, {
      onSuccess: (broadcast) => {
        notifySuccess(t("notifications.sent"));
        setConfirming(false);
        onOpenChange(false);
        onSent?.(broadcast);
      },
      onError: (error) => {
        setConfirming(false);
        notifyError(getFriendlyApiMessage(error, t));
      },
    });
  };

  const submit = () => {
    const input = buildInput();
    if (!input) return;
    if (user) {
      send(input);
    } else {
      setConfirming(true);
    }
  };

  const text = texts[language];
  const setText = (patch: Partial<Text>) =>
    setTexts((current) => ({
      ...current,
      [language]: { ...current[language], ...patch },
    }));

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => !create.isPending && onOpenChange(next)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {user
                ? t("notifications.composeToUser", { name: user.name })
                : t("notifications.compose")}
            </DialogTitle>
            <DialogDescription>
              {t("notifications.composeDescription")}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-5">
            {user ? null : (
              <>
                <FieldSet>
                  <FieldLegend>{t("notifications.audience.label")}</FieldLegend>
                  <AudienceEditor value={audience} onChange={setAudience} />
                  <FieldDescription>
                    {apiAudience === null
                      ? audience.type === "group"
                        ? t("notifications.audience.pickGroup")
                        : t("notifications.audience.pickUsers")
                      : preview.isFetching && !preview.data
                        ? t("notifications.audience.previewLoading")
                        : t("notifications.audience.preview", {
                            recipients: preview.data?.recipients ?? 0,
                            withPush: preview.data?.withPush ?? 0,
                          })}
                  </FieldDescription>
                  <FieldDescription>
                    {t("notifications.audience.excluded")}
                  </FieldDescription>
                  <FieldError
                    errors={
                      errors.audience
                        ? [{ message: t("notifications.audience.pickUsers") }]
                        : undefined
                    }
                  />
                </FieldSet>
                <FieldSeparator />
              </>
            )}

            <FieldSet>
              <FieldLegend>{t("notifications.content.label")}</FieldLegend>
              <FieldDescription>
                {t("notifications.content.hint")}
              </FieldDescription>
              <Tabs
                value={language}
                onValueChange={(value) => setLanguage(value as Language)}
              >
                <TabsList>
                  {(["ru", "en"] as const).map((key) => (
                    <TabsTrigger key={key} value={key}>
                      {t(`notifications.content.languages.${key}`)}
                      {texts[key].body.trim() ? " ·" : ""}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Field>
                <FieldLabel htmlFor="broadcast-title">
                  {t("notifications.content.title")}
                </FieldLabel>
                <Input
                  id="broadcast-title"
                  value={text.title}
                  maxLength={BROADCAST_LIMITS.titleMaxLength}
                  placeholder={t("notifications.content.titlePlaceholder")}
                  onChange={(event) => setText({ title: event.target.value })}
                />
              </Field>
              <Field data-invalid={errors.content || undefined}>
                <FieldLabel htmlFor="broadcast-body">
                  {t("notifications.content.body")}
                </FieldLabel>
                <Textarea
                  id="broadcast-body"
                  value={text.body}
                  rows={5}
                  maxLength={BROADCAST_LIMITS.bodyMaxLength}
                  placeholder={t("notifications.content.bodyPlaceholder")}
                  aria-invalid={errors.content || undefined}
                  onChange={(event) => {
                    setText({ body: event.target.value });
                    setErrors((current) => ({ ...current, content: false }));
                  }}
                />
                <FieldDescription className="text-right tabular-nums">
                  {text.body.length}/{BROADCAST_LIMITS.bodyMaxLength}
                </FieldDescription>
                <FieldError
                  errors={
                    errors.content
                      ? [{ message: t("notifications.content.required") }]
                      : undefined
                  }
                />
              </Field>
            </FieldSet>

            <FieldSeparator />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="broadcast-link">
                  {t("notifications.link.label")}
                </FieldLabel>
                <OptionSelect
                  id="broadcast-link"
                  value={target}
                  options={(
                    ["none", ...NOTIFICATION_LINK_TARGETS] as const
                  ).map((value) => ({
                    value,
                    label: t(`notifications.link.targets.${value}`),
                  }))}
                  onValueChange={(value) => {
                    setTarget(value);
                    setErrors((current) => ({ ...current, url: false }));
                  }}
                />
              </Field>
              {TARGETS_WITH_ID.includes(target) ? (
                <Field>
                  <FieldLabel htmlFor="broadcast-link-id">
                    {t("notifications.link.id")}
                  </FieldLabel>
                  <Input
                    id="broadcast-link-id"
                    value={linkId}
                    onChange={(event) => setLinkId(event.target.value)}
                  />
                  <FieldDescription>
                    {t("notifications.link.idHint")}
                  </FieldDescription>
                </Field>
              ) : null}
              {target === "url" ? (
                <Field data-invalid={errors.url || undefined}>
                  <FieldLabel htmlFor="broadcast-link-url">
                    {t("notifications.link.url")}
                  </FieldLabel>
                  <Input
                    id="broadcast-link-url"
                    type="url"
                    value={url}
                    maxLength={BROADCAST_LIMITS.urlMaxLength}
                    placeholder="https://"
                    aria-invalid={errors.url || undefined}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                  <FieldError
                    errors={
                      errors.url
                        ? [{ message: t("notifications.link.urlInvalid") }]
                        : undefined
                    }
                  />
                </Field>
              ) : null}
            </div>

            <FieldSet>
              <FieldLegend variant="label">
                {t("notifications.channels.label")}
              </FieldLegend>
              <FieldDescription>
                {t("notifications.channels.inbox")}
              </FieldDescription>
              <div className="flex flex-wrap gap-6">
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <Field
                    key={channel}
                    orientation="horizontal"
                    className="w-auto"
                  >
                    <Checkbox
                      id={`broadcast-channel-${channel}`}
                      checked={channels.includes(channel)}
                      onCheckedChange={(checked) =>
                        setChannels((current) =>
                          checked === true
                            ? [...new Set([...current, channel])]
                            : current.filter((item) => item !== channel),
                        )
                      }
                    />
                    <FieldLabel
                      htmlFor={`broadcast-channel-${channel}`}
                      className="font-normal"
                    >
                      {t(`notifications.channels.${channel}`)}
                    </FieldLabel>
                  </Field>
                ))}
              </div>
            </FieldSet>
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={create.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              disabled={create.isPending || (!user && recipients === 0)}
              onClick={submit}
            >
              {create.isPending ? <Spinner /> : null}
              {t("notifications.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("notifications.confirmTitle")}
        description={t("notifications.confirmDescription", {
          count: recipients,
        })}
        confirmLabel={t("notifications.send")}
        destructive={false}
        isPending={create.isPending}
        onConfirm={() => {
          const input = buildInput();
          if (input) send(input);
        }}
      />
    </>
  );
}
