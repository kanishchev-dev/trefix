"use client";

import { useState, type FormEvent } from "react";
import type { ReactElement } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

import { useAuth } from "@/components/auth-provider";
import { authForgotPasswordSchema } from "@/lib/auth";
import { notifyError } from "@/lib/notifications";

export function ForgotPasswordForm(): ReactElement {
  const router = useRouter();
  const { requestPasswordRecovery } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = authForgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      notifyError("Не удалось отправить письмо", parsed.error.flatten().fieldErrors.email?.[0] ?? "Проверьте email");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordRecovery(parsed.data);
      router.push(`/reset-password?email=${encodeURIComponent(parsed.data.email)}`);
    } catch {
      // Error toast is already shown by AuthProvider.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recover your account</CardTitle>
        <CardDescription>
          Enter your email below and we will send recovery instructions to your inbox.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="john.dow@mail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send recovery email"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Remembered your password?{" "}
                <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Return to login
                </Link>
              </div>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
