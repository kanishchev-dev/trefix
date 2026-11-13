import { createContext, useContext } from "react";
import {
  createNavigationContainerRef,
  StackActions,
  type NavigatorScreenParams,
} from "@react-navigation/native";

import { type PlansSegment } from "../plans/lib/plan-card-format";
import { type ProfileRoute } from "../profile/profile-routes";
import { type MainTabKey } from "./main-types";

/** Screens pushed over the tabs. `kind` is the route name, the other fields are its params. */
export type SubScreen =
  | { kind: "integrations" }
  | { kind: "strava-integration" }
  | { kind: "health-integration" }
  | { kind: "plans"; segment?: PlansSegment; highlightPlanId?: string | null }
  | { kind: "plan-details"; planId: string }
  | { kind: "progress-records" }
  | { kind: "progress-metric"; metric: "threshold_pace" | "vo2max" }
  | { kind: "workout-details"; workoutId: string }
  | { kind: "tracker-setup"; plannedWorkoutId?: string | null }
  | { kind: "tracker-recording" }
  | { kind: "tracker-summary" }
  | ProfileRoute;

type SubScreenParams = {
  [K in SubScreen["kind"]]:
    | Omit<Extract<SubScreen, { kind: K }>, "kind">
    | undefined;
};

export type MainTabParamList = Record<MainTabKey, undefined>;

export type MainStackParamList = SubScreenParams & {
  main: NavigatorScreenParams<MainTabParamList> | undefined;
  trefix: undefined;
  profileEdit: undefined;
  notificationsSettings: undefined;
  notifications: undefined;
  languageSettings: undefined;
  themeSettings: undefined;
};

export const mainNavigationRef =
  createNavigationContainerRef<MainStackParamList>();

/** Opens a sub-screen on top of the stack (the same screen may be open twice with other params). */
export function pushSubScreen(screen: SubScreen): void {
  if (!mainNavigationRef.isReady()) return;
  const { kind, ...params } = screen;
  mainNavigationRef.dispatch(
    StackActions.push(
      kind,
      Object.keys(params).length > 0 ? params : undefined,
    ),
  );
}

/** Swaps the top screen, e.g. setup → recording: going back must not return to the setup. */
export function replaceSubScreen(screen: SubScreen): void {
  if (!mainNavigationRef.isReady()) return;
  const { kind, ...params } = screen;
  mainNavigationRef.dispatch(
    StackActions.replace(
      kind,
      Object.keys(params).length > 0 ? params : undefined,
    ),
  );
}

export function goBack(): void {
  if (mainNavigationRef.isReady() && mainNavigationRef.canGoBack()) {
    mainNavigationRef.goBack();
  }
}

/** Closes every pushed screen and shows the tabs. */
export function popToTabs(): void {
  // `canGoBack` also counts the tab history, so check the root stack itself.
  if (
    mainNavigationRef.isReady() &&
    (mainNavigationRef.getRootState()?.routes.length ?? 0) > 1
  ) {
    mainNavigationRef.dispatch(StackActions.popToTop());
  }
}

/** Closes every pushed screen and switches to the tab. */
export function openTab(tab: MainTabKey): void {
  popToTabs();
  if (mainNavigationRef.isReady()) {
    mainNavigationRef.navigate("main", { screen: tab });
  }
}

export function openStackScreen(
  name:
    | "trefix"
    | "profileEdit"
    | "notificationsSettings"
    | "notifications"
    | "languageSettings"
    | "themeSettings",
): void {
  if (mainNavigationRef.isReady()) {
    mainNavigationRef.navigate(name);
  }
}

/** Actions shared by the tabs and the pushed screens. */
export type MainShell = {
  push: (screen: SubScreen) => void;
  back: () => void;
  /** The coach chat, or its setting when the coach is off. */
  openTrefix: () => void;
};

const MainShellContext = createContext<MainShell | null>(null);

export const MainShellProvider = MainShellContext.Provider;

export function useMainShell(): MainShell {
  const value = useContext(MainShellContext);
  if (!value) throw new Error("useMainShell must be used inside MainNavigator");
  return value;
}
