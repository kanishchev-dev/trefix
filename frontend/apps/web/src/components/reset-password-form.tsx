"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ReactElement } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@trefix/ui/components/field";
import { Input } from "@trefix/ui/components/input";

import { useAuth } from "@/components/auth-provider";
import { authResetPasswordSchema } from "@/lib/auth";
import { notifyError } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

type Values = {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
};

export function ResetPasswordForm(): ReactElement {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirmPasswordRecovery } = useAuth();

  const initialValues = useMemo<Values>(
    () => ({
      email: searchParams.get("email") ?? "",
      code: searchParams.get("code") ?? "",
      newPassword: "",
      confirmPassword: "",
    }),
    [searchParams],
  );

  const [values, setValues] = useState<Values>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (values.newPassword !== values.confirmPassword) {
      notifyError(t("auth.passwordResetFailed"), t("auth.passwordMismatch"));
      return;
    }

    const parsed = authResetPasswordSchema.safeParse({
      email: values.email,
      code: values.code,
      newPassword: values.newPassword,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      notifyError(
        t("auth.passwordResetFailed"),
        flattened.email?.[0] ??
          flattened.code?.[0] ??
          flattened.newPassword?.[0] ??
          t("auth.invalidForm"),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordRecovery(parsed.data);
      router.push(`/login?email=${encodeURIComponent(parsed.data.email)}`);
    } catch {
      // Error toast is already shown by AuthProvider.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheckIcon className="size-4" />
          {t("auth.passwordRecoveryTitle")}
        </div>
        <div>
          <CardTitle className="text-2xl">
            {t("auth.newPasswordLabel")}
          </CardTitle>
          <CardDescription>
            {t("auth.passwordRecoveryDescription")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">{t("auth.emailLabel")}</FieldLabel>
              <Input
                id="email"
                autoComplete="email"
                inputMode="email"
                placeholder={t("auth.emailPlaceholder")}
                value={values.email}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="code">{t("auth.codeLabel")}</FieldLabel>
              <Input
                id="code"
                inputMode="numeric"
                placeholder={t("auth.codePlaceholder")}
                value={values.code}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="newPassword">
                {t("auth.newPasswordLabel")}
              </FieldLabel>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder={t("auth.newPasswordPlaceholder")}
                value={values.newPassword}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmPassword">
                {t("auth.confirmPasswordLabel")}
              </FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder={t("auth.confirmPasswordPlaceholder")}
                value={values.confirmPassword}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting
                  ? t("common.actions.loading")
                  : t("auth.passwordRecoveryTitle")}
              </Button>
              <FieldDescription className="text-center text-muted-foreground">
                {t("auth.backToLogin")}{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {t("auth.loginLink")}
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
