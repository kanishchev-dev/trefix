import { Platform } from "react-native";

export const HEALTH_BACKGROUND_TASK = "trefix-health-sync";
export const HEALTH_WORKOUT_TYPE = "HKWorkoutTypeIdentifier";
const ANDROID_INTERVAL_MINUTES = 60;

type HealthKitModule = typeof import("@kingstinct/react-native-healthkit");
const healthKit = (): HealthKitModule => require("@kingstinct/react-native-healthkit") as HealthKitModule;

let iosSubscription: { remove: () => unknown } | null = null;
let iosListener: (() => void) | null = null;

/** The handler a HealthKit wake runs; set once by `registerHealthBackgroundHandlers`. */
export function setIosWorkoutListener(listener: () => void): void {
  iosListener = listener;
}

/** Subscribing before authorization was requested crashes HealthKit: call only for a connected device. */
export function subscribeToIosWorkouts(): void {
  if (iosSubscription || !iosListener) return;
  const listener = iosListener;
  try {
    iosSubscription = healthKit().subscribeToChanges(HEALTH_WORKOUT_TYPE, () => listener());
  } catch {
    // Native module missing from this build: background delivery stays off.
  }
}

/** After connecting: new workouts wake the app (iOS) or a periodic task runs (Android). */
export async function enableHealthBackground(): Promise<void> {
  if (Platform.OS === "ios") {
    const HealthKit = healthKit();
    await HealthKit.configureBackgroundTypes([HEALTH_WORKOUT_TYPE], HealthKit.UpdateFrequency.immediate);
    subscribeToIosWorkouts();
    return;
  }
  if (Platform.OS === "android") {
    const BackgroundTask = require("expo-background-task") as typeof import("expo-background-task");
    await BackgroundTask.registerTaskAsync(HEALTH_BACKGROUND_TASK, { minimumInterval: ANDROID_INTERVAL_MINUTES });
  }
}

export async function disableHealthBackground(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      iosSubscription?.remove();
      iosSubscription = null;
      await healthKit().clearBackgroundTypes();
      return;
    }
    if (Platform.OS === "android") {
      const BackgroundTask = require("expo-background-task") as typeof import("expo-background-task");
      const TaskManager = require("expo-task-manager") as typeof import("expo-task-manager");
      if (await TaskManager.isTaskRegisteredAsync(HEALTH_BACKGROUND_TASK)) {
        await BackgroundTask.unregisterTaskAsync(HEALTH_BACKGROUND_TASK);
      }
    }
  } catch {
    // Already off.
  }
}
