import { Platform } from "react-native";

import { HEALTH_BACKGROUND_TASK, setIosWorkoutListener, subscribeToIosWorkouts } from "./background-control";
import { BACKGROUND_BUDGET_MS, syncHealthNow } from "./runner";
import { getActiveHealthSync } from "./state";

/**
 * Must run at app start, before the first render: iOS may launch the app in
 * the background just to deliver a new workout, and the Android task has to be
 * defined before the OS fires it.
 */
export function registerHealthBackgroundHandlers(): void {
  if (Platform.OS === "android") {
    let TaskManager: typeof import("expo-task-manager");
    let BackgroundTask: typeof import("expo-background-task");
    try {
      TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");
      BackgroundTask = require("expo-background-task") as typeof import("expo-background-task");
    } catch {
      // Build without the background modules: foreground sync still works.
      return;
    }
    TaskManager.defineTask(HEALTH_BACKGROUND_TASK, async () => {
      try {
        await syncHealthNow("background", BACKGROUND_BUDGET_MS.android);
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
    return;
  }
  if (Platform.OS === "ios") {
    setIosWorkoutListener(() => {
      void syncHealthNow("background", BACKGROUND_BUDGET_MS.ios).catch(() => undefined);
    });
    void getActiveHealthSync().then((active) => {
      if (active?.provider === "apple_health") subscribeToIosWorkouts();
    });
  }
}
