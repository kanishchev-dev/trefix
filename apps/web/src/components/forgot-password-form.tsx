"use client";

import { useState, type FormEvent } from "react";
import type { ReactElement } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useAuth } from "@/components/auth-provider";
import { authForgotPasswordSchema } from "@/lib/auth";
import { notifyError } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

export function ForgotPasswordForm(): ReactElement {
  const { t } = useI18n();
  const router = useRouter();
  const { requestPasswordRecovery } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = authForgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      notifyError(
        t("auth.recoveryEmailFailedTitle"),
        parsed.error.flatten().fieldErrors.email?.[0] ?? t("auth.invalidEmail"),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordRecovery(parsed.data);
      router.push(
        `/reset-password?email=${encodeURIComponent(parsed.data.email)}`,
      );
    } catch {
      // Error toast is already shown by AuthProvider.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.forgotPasswordTitle")}</CardTitle>
        <CardDescription>{t("auth.forgotPasswordDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">
                {t("auth.forgotPasswordEmailLabel")}
              </FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.forgotPasswordEmailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t("auth.sending")
                  : t("auth.forgotPasswordSubmit")}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                {t("auth.rememberedPassword")}{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {t("auth.returnToLogin")}
                </Link>
              </div>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
