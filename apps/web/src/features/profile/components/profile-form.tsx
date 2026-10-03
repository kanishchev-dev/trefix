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
import { formatDate, useI18n } from "@/shared/i18n";

import { useAuth } from "@/components/auth-provider";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";

import { AvatarUpload } from "./avatar-upload";

const profileFormSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

/**
 * Self-service profile editor.
 *
 * Only the fields the backend actually accepts are editable here: `firstName`
 * and `lastName`. The avatar is uploaded through its own endpoint, and email
 * is shown read-only on purpose — changing it is not supported by
 * `PATCH /auth/me` and pretending otherwise would be a dead end for the user.
 */
export function ProfileForm(): ReactElement {
  const { t, locale } = useI18n();
  const { user, updateProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  if (!user) {
    return <span aria-hidden="true" />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSaving(true);

    try {
      await updateProfile({
        firstName: values.firstName,
        lastName: values.lastName,
      });
      notifySuccess(t("profile.toasts.updated"));
      form.reset(values);
    } catch (error) {
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.details.title")}</CardTitle>
        <CardDescription>{t("profile.details.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <AvatarUpload />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-first-name">
                {t("profile.fields.firstName")}
              </Label>
              <Input
                id="profile-first-name"
                autoComplete="given-name"
                {...form.register("firstName")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-last-name">
                {t("profile.fields.lastName")}
              </Label>
              <Input
                id="profile-last-name"
                autoComplete="family-name"
                {...form.register("lastName")}
              />
            </div>
          </div>

          <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {t("profile.fields.email")}
              </span>
              <span className="text-sm">{user.email}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {t("profile.fields.memberSince")}
              </span>
              <span className="text-sm">
                {user.createdAt ? formatDate(user.createdAt, locale) : "—"}
              </span>
            </div>
          </div>

          <div>
            <Button type="submit" size="sm" disabled={isSaving}>
              {t("common.actions.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
