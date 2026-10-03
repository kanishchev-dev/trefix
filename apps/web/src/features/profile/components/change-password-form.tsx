"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useAuth } from "@/components/auth-provider";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

const PASSWORD_MISMATCH = "passwords-mismatch";

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  // Refine instead of a field-level rule so the error lands on the field the
  // user actually has to fix. The message is a sentinel: the schema lives
  // outside React and cannot call `t`, so the view translates it.
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: PASSWORD_MISMATCH,
  });

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

/**
 * Self-service password change.
 *
 * The backend revokes the other sessions and hands out a fresh token pair on
 * success, so the auth provider swaps in the returned user afterwards.
 */
export function ChangePasswordForm(): ReactElement {
  const { t } = useI18n();
  const { changePassword } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSaving(true);

    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      form.reset();
      notifySuccess(t("profile.toasts.passwordChanged"));
    } catch (error) {
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.password.title")}</CardTitle>
        <CardDescription>{t("profile.password.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">
              {t("profile.password.current")}
            </Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              {...form.register("currentPassword")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">
                {t("profile.password.new")}
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...form.register("newPassword")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">
                {t("profile.password.confirm")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message ===
                  PASSWORD_MISMATCH
                    ? t("profile.validation.passwordsMismatch")
                    : form.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("profile.password.hint")}
          </p>

          <div>
            <Button type="submit" size="sm" disabled={isSaving}>
              {t("profile.password.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
