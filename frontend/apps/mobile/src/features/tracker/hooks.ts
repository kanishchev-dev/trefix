import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { fillTemplate, type MainCopy } from "../../locales";
import { loadAuthSession } from "../../lib/auth-session";
import { useToast } from "../../shared/ui/toast";
import { pushSubScreen } from "../main/main-routes";
import { recorder, type RecorderSnapshot } from "./recorder";
import { processUploadQueue, type UploadOutcome } from "./storage/uploader";

let restorePrompt = false;
const restoreListeners = new Set<() => void>();

function showRestorePrompt(): void {
  restorePrompt = true;
  for (const listener of restoreListeners) listener();
}

/** Whether Today should ask about an interrupted recording, and how to dismiss it. */
export function useRestorePrompt(): [boolean, () => void] {
  const shown = useSyncExternalStore(
    (listener) => {
      restoreListeners.add(listener);
      return () => restoreListeners.delete(listener);
    },
    () => restorePrompt,
    () => restorePrompt,
  );
  const dismiss = useCallback(() => {
    restorePrompt = false;
    for (const listener of restoreListeners) listener();
  }, []);
  return [shown, dismiss];
}

export function useRecorder(): RecorderSnapshot | null {
  return useSyncExternalStore(
    recorder.subscribe,
    recorder.getSnapshot,
    recorder.getSnapshot,
  );
}

export async function currentUserId(): Promise<string | null> {
  return (await loadAuthSession())?.user.id ?? null;
}

/** Sends queued recordings and tells the user what happened. */
export function useUploadQueue(copy: MainCopy): () => Promise<UploadOutcome[]> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useCallback(async () => {
    const userId = await currentUserId();
    if (!userId) return [];
    const outcomes = await processUploadQueue(userId);
    if (outcomes.some((outcome) => outcome.status === "uploaded")) {
      // A saved run changes the calendar, the plan, progress and the profile metrics.
      void queryClient.invalidateQueries();
    }
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        const message =
          outcome.error instanceof Error
            ? outcome.error.message
            : String(outcome.error);
        showToast(fillTemplate(copy.tracker.uploadRejected, { message }));
      }
    }
    return outcomes;
  }, [copy.tracker.uploadRejected, queryClient, showToast]);
}

/**
 * Once per sign-in: brings back an interrupted recording and opens its screen,
 * and sends recordings saved while offline (now and whenever the app returns).
 */
export function useTrackerBootstrap(copy: MainCopy): void {
  const upload = useUploadQueue(copy);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const userId = await currentUserId();
      if (!userId) return;
      await recorder
        .restore(userId, copy.tracker.notification)
        .catch(() => undefined);
      const snapshot = recorder.getSnapshot();
      if (snapshot) {
        // A run stopped while the app was closed asks what to do on Today;
        // one that kept recording in the background simply goes on.
        if (snapshot.view.status === "paused") showRestorePrompt();
        else
          pushSubScreen({
            kind:
              snapshot.view.status === "finished"
                ? "tracker-summary"
                : "tracker-recording",
          });
      }
      await upload().catch(() => undefined);
    })();
  }, [copy.tracker.notification, upload]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void upload().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [upload]);
}
