"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";

import {
  PLAN_NAME_MAX_LENGTH,
  PLAN_NOTES_MAX_LENGTH,
  type PlanDetails,
} from "@workspace/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

import { useUpdatePlanMeta } from "../hooks/use-user-plans";
import { isVersionConflict } from "../lib/plan-errors";

const metaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "userPlans.meta.errors.name")
    .max(PLAN_NAME_MAX_LENGTH, "userPlans.meta.errors.name"),
  notes: z.string().max(PLAN_NOTES_MAX_LENGTH, "userPlans.meta.errors.notes"),
});

type MetaValues = z.infer<typeof metaSchema>;

/** Name and notes: editable in any status, guarded by the plan version. */
export function PlanMetaDialog({
  userId,
  plan,
  open,
  onOpenChange,
}: {
  userId: string;
  plan: PlanDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): ReactElement {
  const { t } = useI18n();
  const updateMeta = useUpdatePlanMeta(userId, plan.id);
  const form = useForm<MetaValues>({
    resolver: zodResolver(metaSchema),
    defaultValues: { name: plan.name, notes: plan.notes ?? "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: plan.name, notes: plan.notes ?? "" });
    }
  }, [open, plan.name, plan.notes, form]);

  const onSubmit = form.handleSubmit((values) => {
    const notes = values.notes.trim();
    updateMeta.mutate(
      {
        name: values.name.trim(),
        notes: notes.length > 0 ? notes : null,
        expectedVersion: plan.version,
      },
      {
        onSuccess: () => {
          notifySuccess(t("userPlans.toasts.metaUpdated"));
          onOpenChange(false);
        },
        onError: (error) =>
          notifyError(
            t("common.states.error"),
            isVersionConflict(error)
              ? t("userPlans.errors.versionConflict")
              : getFriendlyApiMessage(error, t),
          ),
      },
    );
  });

  const errors = form.formState.errors;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !updateMeta.isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg">
        <form className="flex flex-col gap-6" onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{t("userPlans.meta.title")}</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="plan-name">
                {t("userPlans.meta.name")}
              </FieldLabel>
              <Input
                id="plan-name"
                maxLength={PLAN_NAME_MAX_LENGTH}
                aria-invalid={Boolean(errors.name) || undefined}
                {...form.register("name")}
              />
              <FieldError
                errors={
                  errors.name?.message
                    ? [{ message: t(errors.name.message) }]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={Boolean(errors.notes) || undefined}>
              <FieldLabel htmlFor="plan-notes">
                {t("userPlans.meta.notes")}
              </FieldLabel>
              <Textarea
                id="plan-notes"
                rows={5}
                maxLength={PLAN_NOTES_MAX_LENGTH}
                aria-invalid={Boolean(errors.notes) || undefined}
                {...form.register("notes")}
              />
              <FieldError
                errors={
                  errors.notes?.message
                    ? [{ message: t(errors.notes.message) }]
                    : undefined
                }
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={updateMeta.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" disabled={updateMeta.isPending}>
              {updateMeta.isPending ? <Spinner /> : null}
              {t("common.actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
