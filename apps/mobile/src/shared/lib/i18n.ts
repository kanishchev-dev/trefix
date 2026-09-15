export type SupportedLocale = "ru" | "en";

export type AppStrings = {
  appName: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  continueWithGoogle: string;
  continueWithApple: string;
  emailPlaceholder: string;
  emailLabel: string;
  continue: string;
  termsPrefix: string;
  terms: string;
  privacy: string;
  termsSuffix: string;
  invalidEmail: string;
  emailAuthError: string;
  emailAuthRequestFailed: string;
  enterCodeTitle: string;
  codeSentTo: string;
  resendCodePrefix: string;
  resendCodeAction: string;
  resendCodeNow: string;
  verifyCode: string;
  back: string;
  codePlaceholder: string;
  otpAccessibilityLabel: string;
  codeInvalid: string;
  signOut: string;
  signedInAs: string;
  sessionRestored: string;
  systemTheme: string;
  systemThemeDescription: string;
  lightTheme: string;
  darkTheme: string;
  loading: string;
  providerUnavailable: string;
  socialAuthFailed: string;
  sessionHeading: string;
  sessionDescription: string;
  sessionTokenLabel: string;
};

const ru: AppStrings = {
  appName: "Trefix",
  welcomeTitle: "Добро пожаловать",
  welcomeSubtitle: "Войдите при помощи социальных сетей",
  continueWithGoogle: "Продолжить с Google",
  continueWithApple: "Продолжить с Apple",
  emailPlaceholder: "your@email.com",
  emailLabel: "Email",
  continue: "Продолжить",
  termsPrefix: "Нажимая «Продолжить», вы соглашаетесь с ",
  terms: "Условиями использования",
  privacy: "Политикой конфиденциальности",
  termsSuffix: ".",
  invalidEmail: "Введите корректный email",
  emailAuthError: "Не удалось отправить код",
  emailAuthRequestFailed: "Не удалось запросить код",
  enterCodeTitle: "Введите код",
  codeSentTo: "Код отправлен на",
  resendCodePrefix: "Повторно отправить код через ",
  resendCodeAction: "Повторно отправить код",
  resendCodeNow: "Повторно отправить код",
  verifyCode: "Подтвердить код",
  back: "Назад",
  codePlaceholder: "• • • • • •",
  otpAccessibilityLabel: "Код подтверждения",
  codeInvalid: "Введите 6-значный код",
  signOut: "Выйти",
  signedInAs: "Вы вошли как",
  sessionRestored: "Сессия восстановлена",
  systemTheme: "Системная тема",
  systemThemeDescription: "Приложение следует системной теме и локали при запуске.",
  lightTheme: "Светлая тема",
  darkTheme: "Тёмная тема",
  loading: "Загрузка...",
  providerUnavailable: "Авторизация через этот провайдер пока не подключена.",
  socialAuthFailed: "Не удалось открыть авторизацию",
  sessionHeading: "Сессия",
  sessionDescription: "Access token, refresh token и session ID хранятся безопасно.",
  sessionTokenLabel: "sessionId",
};

const en: AppStrings = {
  appName: "Trefix",
  welcomeTitle: "Welcome",
  welcomeSubtitle: "Continue with social accounts",
  continueWithGoogle: "Continue with Google",
  continueWithApple: "Continue with Apple",
  emailPlaceholder: "your@email.com",
  emailLabel: "Email",
  continue: "Continue",
  termsPrefix: "By tapping “Continue”, you agree to the ",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  termsSuffix: ".",
  invalidEmail: "Enter a valid email",
  emailAuthError: "Could not send the code",
  emailAuthRequestFailed: "Could not request the code",
  enterCodeTitle: "Enter the code",
  codeSentTo: "Code sent to",
  resendCodePrefix: "Resend code in ",
  resendCodeAction: "Resend code",
  resendCodeNow: "Resend code",
  verifyCode: "Verify code",
  back: "Back",
  codePlaceholder: "• • • • • •",
  otpAccessibilityLabel: "Verification code",
  codeInvalid: "Enter the 6-digit code",
  signOut: "Sign out",
  signedInAs: "Signed in as",
  sessionRestored: "Session restored",
  systemTheme: "System theme",
  systemThemeDescription: "The app follows the system appearance and locale on startup.",
  lightTheme: "Light theme",
  darkTheme: "Dark theme",
  loading: "Loading...",
  providerUnavailable: "Sign-in with this provider is not connected yet.",
  socialAuthFailed: "Could not open the sign-in flow",
  sessionHeading: "Session",
  sessionDescription: "Access token, refresh token and session ID are stored securely.",
  sessionTokenLabel: "sessionId",
};

export function resolveLocale(languageTag?: string | null): SupportedLocale {
  const normalized = (languageTag ?? "en").toLowerCase();
  return normalized.startsWith("ru") ? "ru" : "en";
}

export function getAppStrings(languageTag?: string | null): AppStrings {
  return resolveLocale(languageTag) === "ru" ? ru : en;
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutesPart = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secondsPart = (seconds % 60).toString().padStart(2, "0");

  return `${minutesPart}:${secondsPart}`;
}
