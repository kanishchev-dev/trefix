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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";

import type { Gear, GearInput, GearType } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

const GEAR_TYPES: readonly GearType[] = ["shoes", "watch", "sensor"];

type FormState = {
  type: GearType;
  brand: string;
  model: string;
  nickname: string;
  initialDistanceKm: string;
  limitKm: string;
  replaceReminder: boolean;
  isDefault: boolean;
};

function toForm(gear: Gear | null): FormState {
  return {
    type: gear?.type ?? "shoes",
    brand: gear?.brand ?? "",
    model: gear?.model ?? "",
    nickname: gear?.nickname ?? "",
    initialDistanceKm: gear ? String(gear.initialDistanceKm) : "0",
    limitKm: gear?.limitKm ? String(gear.limitKm) : "800",
    replaceReminder: gear?.replaceReminder ?? true,
    isDefault: gear?.isDefault ?? false,
  };
}

export function GearFormDialog({
  gear,
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  /** Null creates a new item. */
  gear: Gear | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (input: GearInput) => void;
}): ReactElement {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => toForm(gear));
  const [invalid, setInvalid] = useState(false);

  // Every opening starts from fresh values.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(toForm(gear));
      setInvalid(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const brand = form.brand.trim();
    const model = form.model.trim();
    const initial = Number(form.initialDistanceKm || 0);
    const limit = form.limitKm ? Math.round(Number(form.limitKm)) : undefined;
    if (
      !brand ||
      !model ||
      !Number.isFinite(initial) ||
      initial < 0 ||
      (limit !== undefined && (limit < 100 || limit > 2000))
    ) {
      setInvalid(true);
      return;
    }
    onSubmit({
      type: form.type,
      brand,
      model,
      nickname: form.nickname.trim() || null,
      initialDistanceKm: initial,
      limitKm: limit,
      replaceReminder: form.replaceReminder,
      isDefault: form.isDefault,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {gear
              ? t("userCard.gear.form.editTitle")
              : t("userCard.gear.form.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("userCard.gear.form.description")}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="gear-type">
              {t("userCard.gear.form.type")}
            </FieldLabel>
            <OptionSelect
              id="gear-type"
              value={form.type}
              options={GEAR_TYPES.map((value) => ({
                value,
                label: t(`userCard.gear.types.${value}`),
              }))}
              onValueChange={(value) => set("type", value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="gear-nickname">
              {t("userCard.gear.form.nickname")}
            </FieldLabel>
            <Input
              id="gear-nickname"
              maxLength={60}
              value={form.nickname}
              onChange={(event) => set("nickname", event.target.value)}
            />
          </Field>
          <Field data-invalid={(invalid && !form.brand.trim()) || undefined}>
            <FieldLabel htmlFor="gear-brand">
              {t("userCard.gear.form.brand")}
            </FieldLabel>
            <Input
              id="gear-brand"
              maxLength={60}
              value={form.brand}
              onChange={(event) => set("brand", event.target.value)}
            />
          </Field>
          <Field data-invalid={(invalid && !form.model.trim()) || undefined}>
            <FieldLabel htmlFor="gear-model">
              {t("userCard.gear.form.model")}
            </FieldLabel>
            <Input
              id="gear-model"
              maxLength={80}
              value={form.model}
              onChange={(event) => set("model", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="gear-initial">
              {t("userCard.gear.form.initialDistance")}
            </FieldLabel>
            <Input
              id="gear-initial"
              type="number"
              min={0}
              step={1}
              value={form.initialDistanceKm}
              onChange={(event) => set("initialDistanceKm", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="gear-limit">
              {t("userCard.gear.form.limit")}
            </FieldLabel>
            <Input
              id="gear-limit"
              type="number"
              min={100}
              max={2000}
              step={50}
              value={form.limitKm}
              onChange={(event) => set("limitKm", event.target.value)}
            />
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="gear-reminder"
              checked={form.replaceReminder}
              onCheckedChange={(checked) =>
                set("replaceReminder", checked === true)
              }
            />
            <FieldLabel htmlFor="gear-reminder" className="font-normal">
              {t("userCard.gear.form.replaceReminder")}
            </FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="gear-default"
              checked={form.isDefault}
              onCheckedChange={(checked) => set("isDefault", checked === true)}
            />
            <FieldLabel htmlFor="gear-default" className="font-normal">
              {t("userCard.gear.form.isDefault")}
            </FieldLabel>
          </Field>
          {invalid ? (
            <FieldError
              className="sm:col-span-2"
              errors={[{ message: t("userCard.gear.form.invalid") }]}
            />
          ) : null}
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
            {gear ? t("common.actions.save") : t("common.actions.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
