import { registerRootComponent } from "expo";

import App from "./App";
import { registerHealthBackgroundHandlers } from "./src/features/health-sync/background";
import { registerTrackerLocationTask } from "./src/features/tracker/sensors/location-task";

// Before the first render: iOS can launch the app in the background only to deliver a new workout.
registerHealthBackgroundHandlers();
// Fixes of a running recording arrive through this task, also while the app is in the background.
registerTrackerLocationTask();

registerRootComponent(App);
