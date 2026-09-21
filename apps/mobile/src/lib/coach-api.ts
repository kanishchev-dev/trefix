import {
  coachChatResponseSchema,
  coachSessionDetailSchema,
  coachSessionSchema,
  type CoachChatResponse,
  type CoachSession,
  type CoachSessionDetail,
  type CreateCoachSessionInput,
  type SendCoachMessageInput,
} from "@workspace/api-client";
import { request } from "./api-client";
import { fetchSseStream } from "./stream-utils";

export async function createCoachSession(
  input: CreateCoachSessionInput,
): Promise<CoachSession> {
  const response = await request<unknown>("/coach/sessions", {
    method: "POST",
    body: input,
    useAuth: true,
  });
  return coachSessionSchema.parse(response);
}

export async function getCoachSession(
  sessionId: string,
): Promise<CoachSessionDetail> {
  const response = await request<unknown>(`/coach/sessions/${sessionId}`, {
    useAuth: true,
  });
  return coachSessionDetailSchema.parse(response);
}

import { ApiClientError } from "@workspace/api-client";

export async function getLatestCoachSession(): Promise<CoachSessionDetail | null> {
  try {
    const response = await request<unknown>("/coach/sessions/latest", {
      useAuth: true,
    });
    return coachSessionDetailSchema.parse(response);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    console.error("[CoachAPI] Error getting latest coach session:", error);
    return null;
  }
}

export async function sendCoachMessage(
  sessionId: string,
  input: SendCoachMessageInput,
): Promise<CoachChatResponse> {
  const response = await request<unknown>(`/coach/sessions/${sessionId}/messages`, {
    method: "POST",
    body: input,
    useAuth: true,
  });
  return coachChatResponseSchema.parse(response);
}

export async function streamCoachMessage(
  sessionId: string,
  message: string,
  abortSignal?: AbortSignal,
) {
  const BACKEND_BASE_URL =
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_AUTH_BACKEND_URL ||
    "http://127.0.0.1:3000/v1";

  const url = `${BACKEND_BASE_URL}/coach/sessions/${sessionId}/stream?message=${encodeURIComponent(
    message,
  )}`;

  return fetchSseStream(url, abortSignal);
}
