"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { InfoIcon } from "lucide-react";

import type { AdminUserDetail } from "@workspace/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { useAuth } from "@/components/auth-provider";
import { UserAvatarUpload } from "@/entities/avatar/ui/avatar-upload";
import { useCreateUser, useUpdateUser } from "@/features/users/hooks/use-users";

const userFormSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    referralCode: z.string().optional(),
    emailVerified: z.boolean(),
    password: z.string().min(8).optional().or(z.literal("")),
  });

type UserFormValues = z.infer<typeof userFormSchema>;

export function UserForm({
  user,
  mode,
}: {
  user?: AdminUserDetail;
  mode: "create" | "edit";
}): ReactElement {
  const { t } = useI18n();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser(user?.id ?? "");
  const [inviteMode, setInviteMode] = useState(true);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      referralCode: user?.referralCode ?? "",
      emailVerified: user?.emailVerified ?? false,
      password: "",
    },
  });

  // Local mirror of the checkbox value: form.watch() is not memoization-safe
  // with the React Compiler and only this switch needs reactivity here.
  const [emailVerifiedChecked, setEmailVerifiedChecked] = useState(
    user?.emailVerified ?? false,
  );

  const isEdit = mode === "edit";
  const canSubmit = !isEdit || hasPermission("users.update");
  const isPending = createUser.isPending || updateUser.isPending;
  const isSystem = user?.isSystem ?? false;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "";

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit) {
      updateUser.mutate(
        {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          emailVerified: values.emailVerified,
          referralCode: values.referralCode,
        },
        {
          onSuccess: () => {
            notifySuccess(t("users.toasts.updated"));
            router.push(`/users/${user?.id}`);
          },
          onError: (error) => {
            notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));
          },
        },
      );
      return;
    }

    const password = inviteMode ? undefined : values.password;
    createUser.mutate(
      {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        emailVerified: values.emailVerified,
        referralCode: values.referralCode,
        password: password && password.length > 0 ? password : undefined,
      },
      {
        onSuccess: (created) => {
          notifySuccess(
            inviteMode ? t("users.toasts.invited") : t("users.toasts.created"),
          );
          router.push(`/users/${created.id}`);
        },
        onError: (error) => {
          notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      {!canSubmit ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4" />
          {t("accessDenied.description")}
        </p>
      ) : null}

      {isSystem ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4" />
          {t("users.system")}
        </p>
      ) : null}

      {isEdit && user ? (
        <UserAvatarUpload
          userId={user.id}
          avatarUrl={user.avatarUrl}
          name={displayName}
          disabled={!canSubmit}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">{t("users.fields.firstName")}</Label>
          <Input id="firstName" disabled={isSystem} {...form.register("firstName")} />
          {form.formState.errors.firstName ? (
            <p className="text-sm text-destructive">
              {t("errors.VALIDATION_ERROR")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">{t("users.fields.lastName")}</Label>
          <Input id="lastName" disabled={isSystem} {...form.register("lastName")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("users.fields.email")}</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">
              {t("errors.VALIDATION_ERROR")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="referralCode">{t("users.fields.referralCode")}</Label>
          <Input id="referralCode" disabled={isSystem} {...form.register("referralCode")} />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <Label htmlFor="emailVerified">{t("users.fields.emailVerified")}</Label>
          <Switch
            id="emailVerified"
            checked={emailVerifiedChecked}
            onCheckedChange={(checked) => {
              setEmailVerifiedChecked(checked);
              form.setValue("emailVerified", checked);
            }}
          />
        </div>
      </div>

      {!isEdit ? (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
          <Label>{t("users.create.modeLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={inviteMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setInviteMode(true)}
            >
              {t("users.create.inviteMode")}
            </Button>
            <Button
              type="button"
              variant={!inviteMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setInviteMode(false)}
            >
              {t("users.create.passwordMode")}
            </Button>
          </div>
          {!inviteMode ? (
            <div className="flex flex-col gap-1">
              <Input
                type="password"
                placeholder={t("users.fields.password")}
                {...form.register("password")}
              />
              <p className="text-xs text-muted-foreground">
                {t("users.fields.passwordHint")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || !canSubmit}>
          {isPending
            ? t("common.actions.loading")
            : isEdit
              ? t("common.actions.save")
              : inviteMode
                ? t("users.create.submitInvite")
                : t("users.create.submitPassword")}
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
