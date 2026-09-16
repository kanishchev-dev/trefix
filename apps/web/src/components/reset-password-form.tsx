"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { ReactElement } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useAuth } from "@/components/auth-provider";
import { authResetPasswordSchema } from "@/lib/auth";
import { notifyError } from "@/lib/notifications";

type Values = {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
};

export function ResetPasswordForm(): ReactElement {
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
      notifyError("Не удалось изменить пароль", "Пароли не совпадают");
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
        "Не удалось изменить пароль",
        flattened.email?.[0] ??
          flattened.code?.[0] ??
          flattened.newPassword?.[0] ??
          "Проверьте введённые данные",
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
    <Card className="w-full border-white/70 bg-white/90 shadow-[0_25px_80px_rgba(15,23,42,0.16)] backdrop-blur">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <ShieldCheckIcon className="size-4" />
          Password reset
        </div>
        <div>
          <CardTitle className="text-2xl">Create a new password</CardTitle>
          <CardDescription>
            Enter the recovery code from email and choose a new password.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                autoComplete="email"
                inputMode="email"
                placeholder="admin@example.com"
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
              <FieldLabel htmlFor="code">Recovery code</FieldLabel>
              <Input
                id="code"
                inputMode="numeric"
                placeholder="123456"
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
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
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
                Confirm password
              </FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat the new password"
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
                {isSubmitting ? "Updating..." : "Reset password"}
              </Button>
              <FieldDescription className="text-center text-slate-500">
                Back to{" "}
                <Link
                  href="/login"
                  className="font-medium text-slate-950 underline-offset-4 hover:underline"
                >
                  login
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
