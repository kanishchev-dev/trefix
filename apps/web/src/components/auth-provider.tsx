"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type {
  AuthUser,
  ApiClientError,
  AuthActivateInviteInput,
  AuthLoginInput,
  AuthForgotPasswordInput,
  AuthResetPasswordInput,
  AuthVerifyEmailInput,
  AuthRequestEmailVerificationInput,
} from "@workspace/api-client";

import {
  activateInvite,
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
import {
  getFriendlyAuthMessage,
} from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  signIn: (input: AuthLoginInput) => Promise<AuthUser>;
  activateInvite: (input: AuthActivateInviteInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  refreshAuth: () => Promise<AuthUser | null>;
  requestPasswordRecovery: (input: AuthForgotPasswordInput) => Promise<void>;
  confirmPasswordRecovery: (input: AuthResetPasswordInput) => Promise<void>;
  verifyEmailAddress: (input: AuthVerifyEmailInput) => Promise<void>;
  resendVerificationEmail: (
    input: AuthRequestEmailVerificationInput,
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isApiClientError(error: unknown): error is ApiClientError {
  return Boolean(error && typeof error === "object" && "status" in error);
}

export function AuthProvider({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  const router = useRouter();
  const { t } = useI18n();
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
        setError(
          isApiClientError(bootstrapError)
            ? getFriendlyAuthMessage(bootstrapError, t)
            : t("errors.default"),
        );
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      isLoading: status === "loading",
      isAuthenticated: status === "authenticated" && Boolean(user),
      permissions: user?.permissions ?? [],
      hasPermission: (permission: string) =>
        (user?.permissions ?? []).includes(permission),
      async signIn(input) {
        setStatus("loading");

        try {
          const tokens = await login(input);
          setUser(tokens.user);
          setStatus("authenticated");
          setError(null);
          notifySuccess(
            t("auth.signInSuccess"),
            tokens.user.email,
          );
          router.replace("/dashboard");
          router.refresh();
          return tokens.user;
        } catch (signInError) {
          setUser(null);
          setStatus("unauthenticated");
          const message = getFriendlyAuthMessage(signInError, t);
          setError(message);
          notifyError(message);
          throw signInError;
        }
      },
      async activateInvite(input) {
        setStatus("loading");

        try {
          const tokens = await activateInvite(input);
          setUser(tokens.user);
          setStatus("authenticated");
          setError(null);
          notifySuccess(t("auth.activationSuccess"));
          router.replace("/dashboard");
          router.refresh();
          return tokens.user;
        } catch (activateError) {
          setStatus("unauthenticated");
          const message = getFriendlyAuthMessage(activateError, t);
          setError(message);
          notifyError(t("auth.activationFailed"), message);
          throw activateError;
        }
      },
      async signOut() {
        try {
          await logout();
        } finally {
          setUser(null);
          setStatus("unauthenticated");
          setError(null);
          notifySuccess(t("auth.signOutSuccess"));
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
          notifySuccess(t("auth.signOutAllSuccess"));
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
          const message = getFriendlyAuthMessage(refreshError, t);
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
          notifySuccess(
            t("auth.recoveryEmailSent"),
            t("auth.recoveryEmailSentDescription"),
          );
        } catch (requestError) {
          const message = getFriendlyAuthMessage(requestError, t);
          setError(message);
          notifyError(t("auth.recoveryEmailFailed"), message);
          throw requestError;
        }
      },
      async confirmPasswordRecovery(input) {
        try {
          await confirmPasswordReset(input);
          notifySuccess(t("auth.passwordChanged"));
        } catch (resetError) {
          const message = getFriendlyAuthMessage(resetError, t);
          setError(message);
          notifyError(t("auth.passwordChangeFailed"), message);
          throw resetError;
        }
      },
      async verifyEmailAddress(input) {
        try {
          await verifyEmail(input);
          notifySuccess(t("auth.emailVerified"));
        } catch (verifyError) {
          const message = getFriendlyAuthMessage(verifyError, t);
          setError(message);
          notifyError(t("auth.emailVerifyFailed"), message);
          throw verifyError;
        }
      },
      async resendVerificationEmail(input) {
        try {
          await resendVerification(input);
          notifySuccess(t("auth.verificationResent"));
        } catch (resendError) {
          const message = getFriendlyAuthMessage(resendError, t);
          setError(message);
          notifyError(t("auth.verificationResendFailed"), message);
          throw resendError;
        }
      },
    }),
    [error, router, status, t, user],
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
