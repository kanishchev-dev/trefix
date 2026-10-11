import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  ApiClientError,
  type AuthTokens,
  type MobileAuthChallenge,
} from "@workspace/api-client";

import {
  requestEmailOtp,
  signInWithAppleNative,
  signInWithGoogleNative,
  verifyEmailOtp,
} from "../../lib/auth-api";
import { getGoogleSigninModule } from "../../lib/google-signin";
import { type AuthCopy } from "../../locales";
import { getErrorMessage } from "../../shared/lib/error-message";

/** Public OAuth client id of the app; not a secret. */
const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  "678050162933-nuf4qfic96t8apc5qbf65udlp4n64582.apps.googleusercontent.com";

/** Estimates used when the backend refuses a new code because one was sent recently. */
const RATE_LIMITED_CHALLENGE = {
  expiresInSeconds: 600,
  resendAfterSeconds: 60,
};

/** Email-code, Google and Apple sign-in; `onSignedIn` receives the issued tokens. */
export function useSignIn(
  copy: AuthCopy,
  onSignedIn: (tokens: AuthTokens) => Promise<void>,
) {
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState<MobileAuthChallenge | null>(null);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isVerificationSubmitting, setIsVerificationSubmitting] =
    useState(false);
  const [isSocialSubmitting, setIsSocialSubmitting] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [isGoogleAuthAvailable, setIsGoogleAuthAvailable] = useState(false);

  useEffect(() => {
    const googleSigninModule = getGoogleSigninModule();
    if (googleSigninModule) {
      googleSigninModule.GoogleSignin.configure({
        webClientId: GOOGLE_CLIENT_ID,
        iosClientId: GOOGLE_CLIENT_ID,
        offlineAccess: false,
      });
    }
    setIsGoogleAuthAvailable(Boolean(googleSigninModule));
  }, []);

  useEffect(() => {
    let isActive = true;
    if (Platform.OS !== "ios") {
      setIsAppleAuthAvailable(false);
      return;
    }
    void AppleAuthentication.isAvailableAsync().then((available) => {
      if (isActive) {
        setIsAppleAuthAvailable(available);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  async function submitEmail(
    submittedEmail: string,
    onCodeSent: () => void,
  ): Promise<void> {
    const normalizedEmail = submittedEmail.trim();
    setIsEmailSubmitting(true);
    try {
      const nextChallenge = await requestEmailOtp(normalizedEmail);
      setEmail(nextChallenge.email);
      setChallenge(nextChallenge);
      onCodeSent();
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === "AUTH_VERIFICATION_CODE_RATE_LIMITED"
      ) {
        // A code was sent recently: go to the code screen with estimated countdowns.
        setEmail(normalizedEmail);
        setChallenge({ email: normalizedEmail, ...RATE_LIMITED_CHALLENGE });
        onCodeSent();
        return;
      }
      Alert.alert(
        copy.errors.authFailedTitle,
        getErrorMessage(error, copy.errors, copy.errors.authFailed),
      );
    } finally {
      setIsEmailSubmitting(false);
    }
  }

  async function submitCode(code: string): Promise<void> {
    if (!challenge) {
      return;
    }
    setIsVerificationSubmitting(true);
    try {
      await onSignedIn(await verifyEmailOtp(challenge.email, code));
    } finally {
      // The error is shown on the code screen: an alert would take the keyboard away.
      setIsVerificationSubmitting(false);
    }
  }

  async function resendCode(): Promise<MobileAuthChallenge> {
    if (!challenge) {
      throw new Error("Verification challenge is missing");
    }
    const nextChallenge = await requestEmailOtp(challenge.email);
    setEmail(nextChallenge.email);
    setChallenge(nextChallenge);
    return nextChallenge;
  }

  async function signInWithProvider(
    signInNative: () => Promise<AuthTokens | null>,
  ): Promise<void> {
    setIsSocialSubmitting(true);
    try {
      const tokens = await signInNative();
      if (tokens) {
        await onSignedIn(tokens);
      }
    } catch (error) {
      Alert.alert(
        copy.errors.socialFailedTitle,
        getErrorMessage(error, copy.errors, copy.errors.socialFailed),
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }

  return {
    email,
    setEmail,
    challenge,
    isEmailSubmitting,
    isVerificationSubmitting,
    isSocialSubmitting,
    isAppleAuthAvailable,
    isGoogleAuthAvailable,
    submitEmail,
    submitCode,
    resendCode,
    signInWithGoogle: () => signInWithProvider(signInWithGoogleNative),
    signInWithApple: () => signInWithProvider(signInWithAppleNative),
  };
}
