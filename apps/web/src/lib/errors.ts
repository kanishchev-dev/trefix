import type { ApiClientError } from "@workspace/api-client";

const FRIENDLY_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Неверный email или пароль",
  AUTH_EMAIL_ALREADY_EXISTS: "Пользователь с таким email уже существует",
  AUTH_EMAIL_NOT_VERIFIED: "Email не подтверждён. Проверьте письмо или запросите повторную отправку кода",
  AUTH_VERIFICATION_CODE_INVALID: "Неверный код подтверждения",
  AUTH_VERIFICATION_CODE_RATE_LIMIT: "Слишком много запросов. Попробуйте позже",
  AUTH_PASSWORD_RESET_CODE_INVALID: "Неверный код восстановления пароля",
  AUTH_PASSWORD_RESET_TOKEN_EXPIRED: "Срок действия кода восстановления истёк",
  AUTH_TOKEN_INVALID: "Сессия истекла. Войдите снова",
  AUTH_SESSION_NOT_FOUND: "Сессия не найдена. Войдите снова",
  AUTH_REFRESH_TOKEN_REUSE: "Сессия была отозвана. Войдите снова",
};

const STATUS_MESSAGES: Record<number, string> = {
  400: "Проверьте введённые данные",
  401: "Требуется повторный вход",
  403: "Недостаточно прав",
  404: "Запрошенный ресурс не найден",
  409: "Возник конфликт данных",
  500: "Не удалось выполнить операцию. Попробуйте позже",
};

export function getFriendlyAuthMessage(error: unknown): string {
  if (isApiClientError(error)) {
    return FRIENDLY_MESSAGES[error.code ?? ""] || STATUS_MESSAGES[error.status] || error.message || "Произошла ошибка";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Произошла ошибка";
}

export function getFriendlyApiMessage(error: unknown): string {
  if (isApiClientError(error)) {
    return FRIENDLY_MESSAGES[error.code ?? ""] || STATUS_MESSAGES[error.status] || error.message || "Произошла ошибка";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Произошла ошибка";
}

function isApiClientError(error: unknown): error is ApiClientError {
  return Boolean(error && typeof error === "object" && "status" in error);
}
