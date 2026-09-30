# Implementation Plan: Render Plan Creation Method Sheet Locally on Current Screen

## Problem
When clicking the "+ (Create Plan / Workout)" button on the mobile app, the app navigates to a separate stack screen (`planCreation`), which pushes a new route (`PlanCreationScreen`). This causes an empty screen (the route's background view) to render first, and only after that does the `PlanCreationMethodSheet` appear.

## Proposed Changes
1. **Move `PlanCreationMethodSheet` to `MainTabsScreen` / `PlanScreen`**:
   - Manage `planCreationSheetVisible` state locally in `MainTabsScreen` (or `PlanScreen`).
   - Render `<PlanCreationMethodSheet>` directly within the active tab view, so it appears as a sheet on the same screen without pushing an empty navigation screen first.
2. **Handle Sheet Actions**:
   - **Trefix AI**: Close the sheet and navigate to the AI chat screen (`onOpenTrefix`).
   - **Create Manually**: Close the sheet and navigate to `planCreation` stack screen (which will start directly on the manual plan creation wizard steps).
3. **Update `PlanCreationScreen`**:
   - Remove or default `showMethodSelector` to `false` so that when navigating to `planCreation` for manual creation, it starts immediately at step 0 (Goal selection) instead of showing a redundant method selector sheet.

## Verification Plan
### Automated Tests
- TypeScript compilation check (`npx tsc --noEmit` or build).
### Manual Verification
- Tap "+" on the Plan screen. Verify that `PlanCreationMethodSheet` slides up instantly on the same screen **without** showing an empty white/dark screen first.
- Tap "With Trefix AI" and "Create manually" to verify correct subsequent navigation.
