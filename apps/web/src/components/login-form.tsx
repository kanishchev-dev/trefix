"use client";

import { useState, type FormEvent } from "react";
import type { ReactElement } from "react";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

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
import { authLoginSchema } from "@/lib/auth";
import { notifyError } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type FormState = {
  email: string;
  password: string;
};

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">): ReactElement {
  const { signIn } = useAuth();
  const [values, setValues] = useState<FormState>({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = authLoginSchema.safeParse(values);
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      notifyError(
        "Не удалось войти",
        flattened.email?.[0] ??
          flattened.password?.[0] ??
          "Проверьте введённые данные",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn(parsed.data);
    } catch {
      // Error toast is already shown by AuthProvider.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="john.dow@mail.com"
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••"
                  value={values.password}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Login"}
                  {!isSubmitting ? <ArrowRightIcon className="size-4" /> : null}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
