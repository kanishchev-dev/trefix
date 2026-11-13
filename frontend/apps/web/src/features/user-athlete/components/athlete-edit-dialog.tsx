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
import { Field, FieldGroup, FieldLabel } from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";
import { Spinner } from "@trefix/ui/components/spinner";
import { Textarea } from "@trefix/ui/components/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trefix/ui/components/toggle-group";

import type {
  AthleteProfile,
  AthleteProfileUpdate,
  TrainingWeekday,
} from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

export const WEEKDAYS: readonly TrainingWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

type NumberKey =
  | "heightCm"
  | "weightKg"
  | "weeklyMileageKm"
  | "sessionsPerWeek"
  | "restingHeartRate"
  | "maxHeartRate"
  | "thresholdHeartRate"
  | "runningSinceYear"
  | "preferredWorkoutDurationMinutes"
  | "longRunMaxDurationMinutes";

const NUMBER_FIELDS: readonly { key: NumberKey; step: number }[] = [
  { key: "heightCm", step: 1 },
  { key: "weightKg", step: 0.1 },
  { key: "weeklyMileageKm", step: 1 },
  { key: "sessionsPerWeek", step: 1 },
  { key: "restingHeartRate", step: 1 },
  { key: "maxHeartRate", step: 1 },
  { key: "thresholdHeartRate", step: 1 },
  { key: "runningSinceYear", step: 1 },
  { key: "preferredWorkoutDurationMinutes", step: 5 },
  { key: "longRunMaxDurationMinutes", step: 5 },
];

const INTEGER_KEYS = new Set<NumberKey>([
  "heightCm",
  "sessionsPerWeek",
  "restingHeartRate",
  "maxHeartRate",
  "thresholdHeartRate",
  "runningSinceYear",
  "preferredWorkoutDurationMinutes",
  "longRunMaxDurationMinutes",
]);

type FormState = {
  birthDate: string;
  sex: "female" | "male" | "none";
  experienceLevel: AthleteProfile["experienceLevel"];
  hrZonesMethod: AthleteProfile["hrZonesMethod"];
  preferredTimeOfDay: AthleteProfile["preferredTimeOfDay"];
  longRunDay: string;
  availableTrainingDays: string[];
  allowDoubles: boolean;
  limitations: string;
  numbers: Record<NumberKey, string>;
};

function toForm(profile: AthleteProfile): FormState {
  const numbers = Object.fromEntries(
    NUMBER_FIELDS.map(({ key }) => [key, profile[key]?.toString() ?? ""]),
  ) as Record<NumberKey, string>;
  return {
    birthDate: profile.birthDate ?? "",
    sex: profile.sex ?? "none",
    experienceLevel: profile.experienceLevel,
    hrZonesMethod: profile.hrZonesMethod,
    preferredTimeOfDay: profile.preferredTimeOfDay,
    longRunDay: profile.longRunDay ?? "none",
    availableTrainingDays: [...profile.availableTrainingDays],
    allowDoubles: profile.allowDoubles,
    limitations: profile.limitations ?? "",
    numbers,
  };
}

function parseNumber(key: NumberKey, value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return INTEGER_KEYS.has(key) ? Math.round(parsed) : parsed;
}

/** Only the fields that differ from the stored profile are sent. */
function toUpdate(
  profile: AthleteProfile,
  form: FormState,
): AthleteProfileUpdate {
  const update: Record<string, unknown> = {};
  const birthDate = form.birthDate || null;
  if (birthDate !== profile.birthDate) update.birthDate = birthDate;
  const sex = form.sex === "none" ? null : form.sex;
  if (sex !== profile.sex) update.sex = sex;
  if (form.experienceLevel !== profile.experienceLevel) {
    update.experienceLevel = form.experienceLevel;
  }
  if (form.hrZonesMethod !== profile.hrZonesMethod) {
    update.hrZonesMethod = form.hrZonesMethod;
  }
  if (form.preferredTimeOfDay !== profile.preferredTimeOfDay) {
    update.preferredTimeOfDay = form.preferredTimeOfDay;
  }
  const longRunDay = form.longRunDay === "none" ? null : form.longRunDay;
  if (longRunDay !== profile.longRunDay) update.longRunDay = longRunDay;
  const days = WEEKDAYS.filter((day) =>
    form.availableTrainingDays.includes(day),
  );
  if (days.join() !== profile.availableTrainingDays.join()) {
    update.availableTrainingDays = days;
  }
  if (form.allowDoubles !== profile.allowDoubles) {
    update.allowDoubles = form.allowDoubles;
  }
  const limitations = form.limitations.trim() || null;
  if (limitations !== profile.limitations) update.limitations = limitations;
  for (const { key } of NUMBER_FIELDS) {
    const value = parseNumber(key, form.numbers[key]);
    if (value !== profile[key]) update[key] = value;
  }
  return update as AthleteProfileUpdate;
}

export function AthleteEditDialog({
  profile,
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  profile: AthleteProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (input: AthleteProfileUpdate) => void;
}): ReactElement {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => toForm(profile));

  // Every opening starts from fresh values.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(toForm(profile));
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const update = toUpdate(profile, form);
    if (Object.keys(update).length === 0) {
      onOpenChange(false);
      return;
    }
    onSubmit(update);
  };

  const label = (key: string) => t(`userCard.athlete.fields.${key}`);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("userCard.athlete.editTitle")}</DialogTitle>
          <DialogDescription>
            {t("userCard.athlete.editDescription")}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="athlete-birth">
              {label("birthDate")}
            </FieldLabel>
            <Input
              id="athlete-birth"
              type="date"
              value={form.birthDate}
              onChange={(event) => set("birthDate", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="athlete-sex">{label("sex")}</FieldLabel>
            <OptionSelect
              id="athlete-sex"
              value={form.sex}
              options={(["none", "female", "male"] as const).map((value) => ({
                value,
                label: t(`userCard.athlete.sex.${value}`),
              }))}
              onValueChange={(value) => set("sex", value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="athlete-level">
              {label("experienceLevel")}
            </FieldLabel>
            <OptionSelect
              id="athlete-level"
              value={form.experienceLevel}
              options={(["beginner", "intermediate", "advanced"] as const).map(
                (value) => ({
                  value,
                  label: t(`userCard.athlete.levels.${value}`),
                }),
              )}
              onValueChange={(value) => set("experienceLevel", value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="athlete-zones">
              {label("hrZonesMethod")}
            </FieldLabel>
            <OptionSelect
              id="athlete-zones"
              value={form.hrZonesMethod}
              options={(["threshold", "max_hr", "custom"] as const).map(
                (value) => ({
                  value,
                  label: t(`userCard.athlete.zonesMethods.${value}`),
                }),
              )}
              onValueChange={(value) => set("hrZonesMethod", value)}
            />
          </Field>
          {NUMBER_FIELDS.map(({ key, step }) => (
            <Field key={key}>
              <FieldLabel htmlFor={`athlete-${key}`}>{label(key)}</FieldLabel>
              <Input
                id={`athlete-${key}`}
                type="number"
                inputMode="decimal"
                step={step}
                min={0}
                value={form.numbers[key]}
                onChange={(event) =>
                  set("numbers", { ...form.numbers, [key]: event.target.value })
                }
              />
            </Field>
          ))}
          <Field>
            <FieldLabel htmlFor="athlete-time">
              {label("preferredTimeOfDay")}
            </FieldLabel>
            <OptionSelect
              id="athlete-time"
              value={form.preferredTimeOfDay}
              options={(["morning", "day", "evening", "any"] as const).map(
                (value) => ({
                  value,
                  label: t(`userCard.athlete.timesOfDay.${value}`),
                }),
              )}
              onValueChange={(value) => set("preferredTimeOfDay", value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="athlete-long-run">
              {label("longRunDay")}
            </FieldLabel>
            <OptionSelect
              id="athlete-long-run"
              value={form.longRunDay}
              options={[
                { value: "none", label: t("userCard.athlete.anyDay") },
                ...WEEKDAYS.map((day) => ({
                  value: day,
                  label: t(`userCard.weekdays.${day}`),
                })),
              ]}
              onValueChange={(value) => set("longRunDay", value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel>{label("availableTrainingDays")}</FieldLabel>
            <ToggleGroup
              multiple
              variant="outline"
              className="flex-wrap"
              value={form.availableTrainingDays}
              onValueChange={(value: string[]) =>
                set("availableTrainingDays", value)
              }
            >
              {WEEKDAYS.map((day) => (
                <ToggleGroupItem key={day} value={day}>
                  {t(`userCard.weekdaysShort.${day}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="athlete-limitations">
              {label("limitations")}
            </FieldLabel>
            <Textarea
              id="athlete-limitations"
              maxLength={500}
              value={form.limitations}
              onChange={(event) => set("limitations", event.target.value)}
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
            {t("common.actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
