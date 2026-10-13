import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getWorkoutCoachNote } from "../../lib/coach-api";
import { useRealtimeEvent } from "../../lib/realtime";
import { queryKeys } from "../../shared/lib/query-keys";

/** Fallback polling while the note is written, in case the realtime event is missed. */
const PENDING_POLL_MS = 4000;
/** Stop waiting after this: the note will show up the next time the screen opens. */
const PENDING_GIVE_UP_MS = 60_000;

/**
 * The coach's note to a workout. The backend answers `pending` while it writes
 * the note and sends `coach.workout_note.ready` when done.
 */
export function useWorkoutCoachNote(workoutId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const openedAt = useRef(Date.now());
  const queryKey = queryKeys.coach.workoutNote(workoutId);

  const query = useQuery({
    queryKey,
    queryFn: () => getWorkoutCoachNote(workoutId),
    enabled: enabled && Boolean(workoutId),
    staleTime: 5 * 60_000,
    retry: false,
    refetchInterval: (current) =>
      current.state.data?.status === "pending" &&
      Date.now() - openedAt.current < PENDING_GIVE_UP_MS
        ? PENDING_POLL_MS
        : false,
  });

  useRealtimeEvent<{ workoutId?: string }>(
    "coach.workout_note.ready",
    (payload) => {
      if (payload?.workoutId === workoutId) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  );

  return query;
}
