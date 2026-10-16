"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@trefix/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";

import { useI18n } from "@/shared/i18n";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  isPending: boolean;
  onSubmit: (email: string) => void;
}): ReactElement {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);

  // Every opening starts from fresh values.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setEmail("");
      setInvalid(false);
    }
  }

  const submit = () => {
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value) || value === currentEmail) {
      setInvalid(true);
      return;
    }
    onSubmit(value);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("userCard.account.changeEmail.title")}</DialogTitle>
          <DialogDescription>
            {t("userCard.account.changeEmail.description", {
              email: currentEmail,
            })}
          </DialogDescription>
        </DialogHeader>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="change-email">
            {t("userCard.account.changeEmail.label")}
          </FieldLabel>
          <Input
            id="change-email"
            type="email"
            value={email}
            aria-invalid={invalid || undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setInvalid(false);
            }}
          />
          <FieldError
            errors={
              invalid
                ? [{ message: t("userCard.account.changeEmail.invalid") }]
                : undefined
            }
          />
        </Field>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button disabled={isPending} onClick={submit}>
            {isPending ? <Spinner /> : null}
            {t("common.actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
