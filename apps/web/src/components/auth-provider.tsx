"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { AuthUser, ApiClientError, AuthLoginInput, AuthForgotPasswordInput, AuthResetPasswordInput, AuthVerifyEmailInput, AuthRequestEmailVerificationInput } from "@workspace/api-client";

import {
  confirmPasswordReset,
  getCurrentUser,
  login,
  logout,
  logoutAll,
  refreshSession,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
} from "@/lib/api";
import { getFriendlyAuthMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  permissions: string[];
  signIn: (input: AuthLoginInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  refreshAuth: () => Promise<AuthUser | null>;
  requestPasswordRecovery: (input: AuthForgotPasswordInput) => Promise<void>;
  confirmPasswordRecovery: (input: AuthResetPasswordInput) => Promise<void>;
  verifyEmailAddress: (input: AuthVerifyEmailInput) => Promise<void>;
  resendVerificationEmail: (input: AuthRequestEmailVerificationInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isApiClientError(error: unknown): error is ApiClientError {
  return Boolean(error && typeof error === "object" && "status" in error);
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const currentUser = await getCurrentUser();
        if (!isMounted) {
          return;
        }

        setUser(currentUser);
        setStatus("authenticated");
        setError(null);
      } catch (bootstrapError) {
        if (!isMounted) {
          return;
        }

        setUser(null);
        setStatus("unauthenticated");
        setError(isApiClientError(bootstrapError) ? getFriendlyAuthMessage(bootstrapError) : "Не удалось проверить авторизацию");
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated" && Boolean(user),
      permissions: user?.permissions ?? [],
      async signIn(input) {
        setStatus("loading");

        try {
          const tokens = await login(input);
          setUser(tokens.user);
          setStatus("authenticated");
          setError(null);
          notifySuccess("Вход выполнен", `Добро пожаловать, ${tokens.user.email}`);
          router.replace("/");
          router.refresh();
          return tokens.user;
        } catch (signInError) {
          setUser(null);
          setStatus("unauthenticated");
          const message = getFriendlyAuthMessage(signInError);
          setError(message);
          notifyError(message);
          throw signInError;
        }
      },
      async signOut() {
        try {
          await logout();
        } finally {
          setUser(null);
          setStatus("unauthenticated");
          setError(null);
          notifySuccess("Выход выполнен");
          router.replace("/login");
          router.refresh();
        }
      },
      async signOutAll() {
        try {
          await logoutAll();
        } finally {
          setUser(null);
          setStatus("unauthenticated");
          setError(null);
          notifySuccess("Все сессии завершены");
          router.replace("/login");
          router.refresh();
        }
      },
      async refreshAuth() {
        try {
          await refreshSession();
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          setStatus("authenticated");
          setError(null);
          return currentUser;
        } catch (refreshError) {
          setUser(null);
          setStatus("unauthenticated");
          const message = getFriendlyAuthMessage(refreshError);
          setError(message);
          notifyError(message);
          router.replace("/login");
          router.refresh();
          return null;
        }
      },
      async requestPasswordRecovery(input) {
        try {
          await requestPasswordReset(input);
          notifySuccess("Письмо отправлено", "Если адрес найден, инструкции уже отправлены на почту");
        } catch (requestError) {
          const message = getFriendlyAuthMessage(requestError);
          setError(message);
          notifyError("Не удалось отправить письмо", message);
          throw requestError;
        }
      },
      async confirmPasswordRecovery(input) {
        try {
          await confirmPasswordReset(input);
          notifySuccess("Пароль успешно изменён");
        } catch (resetError) {
          const message = getFriendlyAuthMessage(resetError);
          setError(message);
          notifyError("Не удалось изменить пароль", message);
          throw resetError;
        }
      },
      async verifyEmailAddress(input) {
        try {
          await verifyEmail(input);
          notifySuccess("Email подтверждён");
        } catch (verifyError) {
          const message = getFriendlyAuthMessage(verifyError);
          setError(message);
          notifyError("Не удалось подтвердить email", message);
          throw verifyError;
        }
      },
      async resendVerificationEmail(input) {
        try {
          await resendVerification(input);
          notifySuccess("Письмо для подтверждения отправлено повторно");
        } catch (resendError) {
          const message = getFriendlyAuthMessage(resendError);
          setError(message);
          notifyError("Не удалось отправить письмо", message);
          throw resendError;
        }
      },
    }),
    [error, router, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
