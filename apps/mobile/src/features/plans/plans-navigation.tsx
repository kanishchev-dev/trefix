import { createContext, useContext } from "react";

import { type PlanCreationLaunch } from "../plan-creation/plan-creation-screen";
import { type PlansSegment } from "./lib/plan-card-format";

/**
 * Navigation between the plans screens, sheets and the creation flow. The
 * plans screens live inside the main tabs (shared header, tab bar and
 * creation overlay), so the host provides these actions.
 */
export type PlansNavigation = {
  openPlans: (options?: { segment?: PlansSegment; highlightPlanId?: string | null; source?: string }) => void;
  openPlanDetails: (planId: string) => void;
  /** Back to the Plan tab with the plan in progress. */
  openPlanTab: () => void;
  openCreationMethod: () => void;
  openCreation: (launch: PlanCreationLaunch) => void;
  openDraftEdit: (planId: string) => void;
  startDraft: (plan: { id: string; name: string }, entry: string) => void;
  openIntegrations: () => void;
  back: () => void;
};

const noop = () => undefined;

const PlansNavigationContext = createContext<PlansNavigation>({
  openPlans: noop,
  openPlanDetails: noop,
  openPlanTab: noop,
  openCreationMethod: noop,
  openCreation: noop,
  openDraftEdit: noop,
  startDraft: noop,
  openIntegrations: noop,
  back: noop,
});

export const PlansNavigationProvider = PlansNavigationContext.Provider;

export function usePlansNavigation(): PlansNavigation {
  return useContext(PlansNavigationContext);
}
