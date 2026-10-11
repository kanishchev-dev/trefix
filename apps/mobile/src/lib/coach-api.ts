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
import { postSseStream } from "./stream-utils";

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
import { logger } from "./logger";

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
    logger.error("[CoachAPI] Error getting latest coach session:", error);
    return null;
  }
}

export async function sendCoachMessage(
  sessionId: string,
  input: SendCoachMessageInput,
): Promise<CoachChatResponse> {
  const response = await request<unknown>(
    `/coach/sessions/${sessionId}/messages`,
    {
      method: "POST",
      body: input,
      useAuth: true,
    },
  );
  return coachChatResponseSchema.parse(response);
}

/** Streams the coach reply; the message goes in the request body, never in the URL. */
export async function streamCoachMessage(
  sessionId: string,
  message: string,
  abortSignal?: AbortSignal,
) {
  return postSseStream(
    `/coach/sessions/${sessionId}/stream`,
    { message },
    abortSignal,
  );
}

/** Clears the chat history with the coach; plans and workouts stay. */
export async function clearCoachHistory(): Promise<void> {
  await request<void>("/coach/sessions", { method: "DELETE", useAuth: true });
}
