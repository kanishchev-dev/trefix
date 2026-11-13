import type { LocationObject } from "expo-location";
import * as TaskManager from "expo-task-manager";

import { recorder, TRACKER_LOCATION_TASK } from "../recorder";

/**
 * Must run at module load, before the first render: the OS delivers fixes to
 * this task while the app is in the background, and on Android it can wake the
 * app only to deliver them.
 */
export function registerTrackerLocationTask(): void {
  if (TaskManager.isTaskDefined(TRACKER_LOCATION_TASK)) return;
  TaskManager.defineTask<{ locations: LocationObject[] }>(
    TRACKER_LOCATION_TASK,
    async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      await recorder.handleLocations(data.locations);
    },
  );
}
