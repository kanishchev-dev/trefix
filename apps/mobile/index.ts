import { registerRootComponent } from "expo";

import App from "./App";
import { registerHealthBackgroundHandlers } from "./src/features/health-sync/background";

// Before the first render: iOS can launch the app in the background only to deliver a new workout.
registerHealthBackgroundHandlers();

registerRootComponent(App);
