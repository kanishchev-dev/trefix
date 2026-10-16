import {
  adminCoachNoteListSchema,
  adminCoachSessionListSchema,
  coachSessionDetailSchema,
  type AdminCoachNoteList,
  type AdminCoachSessionList,
  type CoachSessionDetail,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

const base = (userId: string) => `/api/admin/users/${userId}/coach`;

export async function fetchUserCoachSessions(
  userId: string,
): Promise<AdminCoachSessionList> {
  return adminCoachSessionListSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/sessions`),
  );
}

export async function fetchUserCoachSession(
  userId: string,
  sessionId: string,
): Promise<CoachSessionDetail> {
  return coachSessionDetailSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/sessions/${sessionId}`),
  );
}

export function clearUserCoachHistory(userId: string): Promise<void> {
  return apiRequest<void>(`${base(userId)}/sessions`, { method: "DELETE" });
}

export async function fetchUserCoachNotes(
  userId: string,
): Promise<AdminCoachNoteList> {
  return adminCoachNoteListSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/workout-notes`),
  );
}
