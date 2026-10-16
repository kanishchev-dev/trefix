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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";
import { parseHoursMinutesSeconds } from "@trefix/utils";

import type { RaceResultInput } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

export const RESULT_DISTANCES = [
  { key: "1k", meters: 1000 },
  { key: "5k", meters: 5000 },
  { key: "10k", meters: 10000 },
  { key: "half_marathon", meters: 21097 },
  { key: "marathon", meters: 42195 },
] as const;

type Kind = RaceResultInput["kind"];

export function AddResultDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (input: RaceResultInput) => void;
}): ReactElement {
  const { t } = useI18n();
  const [distance, setDistance] = useState<string>("5k");
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<Kind>("race");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ time?: boolean; date?: boolean }>({});

  // Every opening starts from fresh values.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDistance("5k");
      setTime("");
      setDate("");
      setKind("race");
      setName("");
      setErrors({});
    }
  }

  const submit = () => {
    const seconds = parseHoursMinutesSeconds(time);
    const next = { time: seconds === null || seconds < 60, date: !date };
    setErrors(next);
    if (next.time || next.date || seconds === null) return;
    const meters =
      RESULT_DISTANCES.find((item) => item.key === distance)?.meters ?? 5000;
    onSubmit({
      distanceM: meters,
      timeSeconds: seconds,
      date,
      kind,
      name: name.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("userCard.progress.addResult.title")}</DialogTitle>
          <DialogDescription>
            {t("userCard.progress.addResult.description")}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="result-distance">
              {t("userCard.progress.addResult.distance")}
            </FieldLabel>
            <OptionSelect
              id="result-distance"
              value={distance}
              options={RESULT_DISTANCES.map((item) => ({
                value: item.key,
                label: t(`userCard.progress.distances.${item.key}`),
              }))}
              onValueChange={setDistance}
            />
          </Field>
          <Field data-invalid={errors.time || undefined}>
            <FieldLabel htmlFor="result-time">
              {t("userCard.progress.addResult.time")}
            </FieldLabel>
            <Input
              id="result-time"
              placeholder="0:22:41"
              value={time}
              aria-invalid={errors.time || undefined}
              onChange={(event) => setTime(event.target.value)}
            />
            <FieldError
              errors={
                errors.time
                  ? [{ message: t("userCard.progress.addResult.timeInvalid") }]
                  : undefined
              }
            />
          </Field>
          <Field data-invalid={errors.date || undefined}>
            <FieldLabel htmlFor="result-date">
              {t("userCard.progress.addResult.date")}
            </FieldLabel>
            <Input
              id="result-date"
              type="date"
              value={date}
              aria-invalid={errors.date || undefined}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="result-kind">
              {t("userCard.progress.addResult.kind")}
            </FieldLabel>
            <OptionSelect
              id="result-kind"
              value={kind}
              options={(["race", "workout", "test"] as const).map((value) => ({
                value,
                label: t(`userCard.progress.kinds.${value}`),
              }))}
              onValueChange={setKind}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="result-name">
              {t("userCard.progress.addResult.name")}
            </FieldLabel>
            <Input
              id="result-name"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
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
          <Button disabled={isPending} onClick={submit}>
            {isPending ? <Spinner /> : null}
            {t("common.actions.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
