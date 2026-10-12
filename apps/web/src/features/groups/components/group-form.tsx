"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@trefix/ui/components/button";
import { Input } from "@trefix/ui/components/input";
import { Label } from "@trefix/ui/components/label";
import { Textarea } from "@trefix/ui/components/textarea";
import { InfoIcon } from "lucide-react";

import type { PermissionGroup } from "@trefix/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import {
  useCreateGroup,
  useUpdateGroup,
} from "@/features/permissions/hooks/use-permissions";

const groupFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

export function GroupForm({
  group,
  mode,
}: {
  group?: PermissionGroup;
  mode: "create" | "edit";
}): ReactElement {
  const { t } = useI18n();
  const router = useRouter();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();

  const isEdit = mode === "edit";
  const isSystem = group?.isSystem ?? false;

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: group?.name ?? "",
      description: group?.description ?? "",
    },
  });

  const isPending = createGroup.isPending || updateGroup.isPending;

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit && group) {
      updateGroup.mutate(
        { id: group.id, name: values.name, description: values.description },
        {
          onSuccess: () => {
            notifySuccess(t("groups.toasts.updated"));
            router.push(`/users/groups/${group.id}`);
          },
          onError: (error) =>
            notifyError(
              t("common.states.error"),
              getFriendlyApiMessage(error, t),
            ),
        },
      );
      return;
    }

    createGroup.mutate(values, {
      onSuccess: (created) => {
        notifySuccess(t("groups.toasts.created"));
        router.push(`/users/groups/${created.id}`);
      },
      onError: (error) =>
        notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
    });
  });

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      {isSystem ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4" />
          {t("groups.system")}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("groups.fields.name")}</Label>
        <Input id="name" disabled={isSystem} {...form.register("name")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("groups.fields.description")}</Label>
        <Textarea
          id="description"
          rows={3}
          disabled={isSystem}
          {...form.register("description")}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || isSystem}>
          {isPending
            ? t("common.actions.loading")
            : isEdit
              ? t("common.actions.save")
              : t("common.actions.create")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          {t("common.actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
