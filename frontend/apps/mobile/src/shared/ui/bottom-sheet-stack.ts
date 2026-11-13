import { Dimensions } from "react-native";

export const SCREEN_HEIGHT = Dimensions.get("window").height;

export const SHEET_SPRING_CONFIG = {
  damping: 28,
  stiffness: 220,
  mass: 0.8,
};

// Stack look: every card has the same fixed height, so the active sheet always
// sits at exactly the same position while the previous one peeks out above it.
// Layers older than the previous one are parked fully off-screen (only two
// windows are ever visible at once), fading in/out when they enter/leave.
export const STACK_BG_SCALE = 0.92;

export const STACK_BG_OFFSET = -48;

export const MAX_STACK_LAYERS = 8;

export const STACK_CARD_HEIGHT = Math.round(SCREEN_HEIGHT * 0.78);

export const STACK_PARKED_OFFSET = 140;

export const STACK_SPRING_CONFIG = {
  damping: 30,
  stiffness: 380,
  mass: 0.9,
};

// Close timing matches the single-sheet close exactly (translateY 220ms +
// 200ms backdrop fade), so the plan-creation stack feels identical.
export const STACK_EXIT_TIMING = { duration: 220 };

export const STACK_FADE_IN = { duration: 160 };

export const STACK_FADE_OUT = { duration: 140 };

export type StackLayerRole = "top" | "behind" | "parked";

export function getStackLayerRole(
  layerIndex: number,
  layerCount: number,
): StackLayerRole {
  if (layerIndex >= layerCount) {
    return "parked";
  }
  if (layerIndex === layerCount - 1) {
    return "top";
  }
  if (layerIndex === layerCount - 2) {
    return "behind";
  }
  return "parked";
}

export function getStackLayerTargetY(role: StackLayerRole): number {
  if (role === "top") {
    return 0;
  }
  if (role === "behind") {
    return STACK_BG_OFFSET;
  }
  return SCREEN_HEIGHT + STACK_PARKED_OFFSET;
}
