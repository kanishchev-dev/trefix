"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  ChangePasswordInput,
  UpdateUserInput,
} from "@trefix/api-client";

import {
  activateInvite,
  changePassword as changePasswordRequest,
  confirmPasswordReset,
  getCurrentUser,
  login,
  logout,
  logoutAll,
  refreshSession,
  requestPasswordReset,
  resendVerification,
  updateProfile as updateProfileRequest,
  verifyEmail,
} from "@/lib/api";
import { getFriendlyAuthMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { useAppSettings } from "@/shared/state/app-settings-provider";

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
  updateProfile: (input: UpdateUserInput) => Promise<AuthUser>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  setAvatarUrl: (avatarUrl: string) => void;
  refreshAuth: () => Promise<AuthUser | null>;
  /** Repeats the session lookup after the backend was unavailable (`status === "error"`). */
  retrySession: () => void;
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

/**
 * Whether a failed session lookup is worth retrying.
 *
 * A rate limit or a backend hiccup is not a statement about the session: giving
 * up on the first such response used to leave the app without a user, which in
 * turn means no realtime connection at all and no hint why. A genuine 401 is an
 * answer and is not retried.
 */
function isTransientAuthError(error: unknown): boolean {
  if (!isApiClientError(error)) {
    // No status at all: a network or fetch failure, worth one more try.
    return true;
  }

  return error.status === 429 || error.status >= 500;
}

export function AuthProvider({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  const router = useRouter();
  const { t } = useI18n();
  // The settings provider wraps this one, so it mounts first and fetches
  // settings while there is still no session — a request that can only be
  // answered with 401. Each place below that establishes a session asks again,
  // which is the earliest moment the fetch can actually succeed.
  const { syncFromBackend } = useAppSettings();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by `retrySession` to run the session lookup again. */
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  /**
   * The translator changes identity whenever the locale settles, and that
   * happens right after the first load: settings bootstrap overwrites the
   * default locale with the one the backend reports.
   *
   * Reading it straight inside the bootstrap effect made the session lookup
   * depend on it, so the lookup ran a second time — two `/auth/me` requests
   * racing each other, and a first-load UI whose state depended on which
   * answer landed last. The ref keeps the current translator without making it
   * a trigger for the session lookup.
   */
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const attempts = 3;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const currentUser = await getCurrentUser();
          if (!isMounted) {
            return;
          }

          setUser(currentUser);
          setStatus("authenticated");
          setError(null);
          syncFromBackend();
          return;
        } catch (bootstrapError) {
          const transient = isTransientAuthError(bootstrapError);

          if (!transient || attempt === attempts) {
            if (!isMounted) {
              return;
            }

            setUser(null);
            // A backend that does not answer is not a verdict on the session:
            // "unauthenticated" here sent the dashboard to /login, the
            // proxy saw a valid cookie and sent it back — forever.
            setStatus(transient ? "error" : "unauthenticated");
            setError(
              isApiClientError(bootstrapError)
                ? getFriendlyAuthMessage(bootstrapError, tRef.current)
                : tRef.current("errors.default"),
            );
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [syncFromBackend, bootstrapAttempt]);

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
      retrySession() {
        setStatus("loading");
        setBootstrapAttempt((value) => value + 1);
      },
      async signIn(input) {
        setStatus("loading");

        try {
          const tokens = await login(input);
          setUser(tokens.user);
          setStatus("authenticated");
          setError(null);
          syncFromBackend();
          notifySuccess(t("auth.signInSuccess"), tokens.user.email);
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
          syncFromBackend();
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
      /**
       * Saves the own profile and swaps the cached user for the fresh one the
       * backend returns, so the sidebar name updates without a reload.
       */
      async updateProfile(input) {
        const updatedUser = await updateProfileRequest(input);
        setUser(updatedUser);
        return updatedUser;
      },
      async changePassword(input) {
        const tokens = await changePasswordRequest(input);
        setUser(tokens.user);
      },
      /**
       * Applies an avatar URL the backend just handed out. The upload endpoint
       * already persisted it, so only the cached user has to be updated.
       */
      setAvatarUrl(avatarUrl) {
        setUser((current) => (current ? { ...current, avatarUrl } : current));
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
    [error, router, status, syncFromBackend, t, user],
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
