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
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";
import { Textarea } from "@trefix/ui/components/textarea";

import {
  USER_BLOCK_REASONS,
  type BlockUserInput,
  type UserBlockReason,
} from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

type Duration = "permanent" | "1d" | "7d" | "30d" | "custom";

const DURATIONS: readonly Duration[] = [
  "permanent",
  "1d",
  "7d",
  "30d",
  "custom",
];
const DURATION_DAYS: Partial<Record<Duration, number>> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
};

function resolveUntil(duration: Duration, customDate: string): string | null {
  if (duration === "permanent") return null;
  if (duration === "custom") {
    if (!customDate) return null;
    // The block ends at the end of the chosen local day.
    return new Date(`${customDate}T23:59:59`).toISOString();
  }
  const days = DURATION_DAYS[duration] ?? 0;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function BlockUserDialog({
  open,
  onOpenChange,
  userName,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  isPending: boolean;
  onSubmit: (input: BlockUserInput) => void;
}): ReactElement {
  const { t } = useI18n();
  const [reason, setReason] = useState<UserBlockReason>("policy_violation");
  const [duration, setDuration] = useState<Duration>("permanent");
  const [customDate, setCustomDate] = useState("");
  const [comment, setComment] = useState("");
  const [revokeSessions, setRevokeSessions] = useState(true);
  const [notify, setNotify] = useState(false);
  const [dateError, setDateError] = useState(false);

  // Every opening starts from fresh values.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("policy_violation");
      setDuration("permanent");
      setCustomDate("");
      setComment("");
      setRevokeSessions(true);
      setNotify(false);
      setDateError(false);
    }
  }

  const submit = () => {
    const until = resolveUntil(duration, customDate);
    if (duration === "custom" && (!until || new Date(until) <= new Date())) {
      setDateError(true);
      return;
    }
    onSubmit({
      reason,
      comment: comment.trim() || undefined,
      until: until ?? undefined,
      revokeSessions,
      notify,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("userCard.block.title")}</DialogTitle>
          <DialogDescription>
            {t("userCard.block.description", { name: userName })}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="block-reason">
              {t("userCard.block.reason")}
            </FieldLabel>
            <OptionSelect
              id="block-reason"
              value={reason}
              options={USER_BLOCK_REASONS.map((value) => ({
                value,
                label: t(`userCard.blockReasons.${value}`),
              }))}
              onValueChange={setReason}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="block-duration">
              {t("userCard.block.duration")}
            </FieldLabel>
            <OptionSelect
              id="block-duration"
              value={duration}
              options={DURATIONS.map((value) => ({
                value,
                label: t(`userCard.block.durations.${value}`),
              }))}
              onValueChange={(value) => {
                setDuration(value);
                setDateError(false);
              }}
            />
          </Field>

          {duration === "custom" ? (
            <Field data-invalid={dateError || undefined}>
              <FieldLabel htmlFor="block-until">
                {t("userCard.block.until")}
              </FieldLabel>
              <Input
                id="block-until"
                type="date"
                value={customDate}
                aria-invalid={dateError || undefined}
                onChange={(event) => {
                  setCustomDate(event.target.value);
                  setDateError(false);
                }}
              />
              <FieldError
                errors={
                  dateError
                    ? [{ message: t("userCard.block.untilInvalid") }]
                    : undefined
                }
              />
            </Field>
          ) : null}

          <Field>
            <FieldLabel htmlFor="block-comment">
              {t("userCard.block.comment")}
            </FieldLabel>
            <Textarea
              id="block-comment"
              value={comment}
              maxLength={1000}
              placeholder={t("userCard.block.commentPlaceholder")}
              onChange={(event) => setComment(event.target.value)}
            />
            <FieldDescription>
              {t("userCard.block.commentHint")}
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="block-revoke"
              checked={revokeSessions}
              onCheckedChange={(checked) => setRevokeSessions(checked === true)}
            />
            <FieldLabel htmlFor="block-revoke" className="font-normal">
              {t("userCard.block.revokeSessions")}
            </FieldLabel>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="block-notify"
              checked={notify}
              onCheckedChange={(checked) => setNotify(checked === true)}
            />
            <FieldLabel htmlFor="block-notify" className="font-normal">
              {t("userCard.block.notify")}
            </FieldLabel>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={submit}>
            {isPending ? <Spinner /> : null}
            {t("userCard.actions.block")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
