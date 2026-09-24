# Implementation Plan: Today Screen Integration & Direct Workout Management

Integrate the mobile Today screen with the NestJS backend to display real events/workouts, allow users to schedule future workouts, and log completed workouts directly on any chosen day (with or without an active training plan).

---

## User Review Required

> [!IMPORTANT]
> **API Contracts & Functionality Highlights:**
> 1. **Direct Workout Creation/Logging**: The backend will support adding workouts independently of training plans. Users can either schedule a future run or log a completed workout (with actual distance, duration, pace, HR, RPE, notes) which automatically updates their training load and runner fitness state.
> 2. **Calendar Event Markers**: Workouts will be fetched for a dynamic date range based on calendar view date range. Days with workouts will show dot indicators in the calendar header.
> 3. **Workout Completion Sheet**: Tapping a planned workout will open a detail sheet where users can mark it as completed with actual metrics, triggering the training engine analysis.

---

## Proposed Changes

### Backend (`backend/src/modules/training/`)

#### [NEW] [create-workout.dto.ts](file:///Users/kanishchev/Projects/trefix/backend/src/modules/training/dto/create-workout.dto.ts)
- Create `CreateWorkoutDto` with validation decorators (`class-validator`):
  - `scheduledAt`: string (ISO 8601 date)
  - `type`: optional enum (`WORKOUT_TYPES`), default `'easy'`
  - `title`: optional string
  - `description`: optional string
  - `durationMinutes`: optional number
  - `distanceKm`: optional number
  - `status`: optional enum (`'planned'`, `'completed'`), default `'planned'`
  - `actualDurationMinutes`: optional number
  - `actualDistanceKm`: optional number
  - `actualAveragePaceSecondsPerKm`: optional number
  - `actualAverageHeartRate`: optional number
  - `rpe`: optional number
  - `notes`: optional string

#### [MODIFY] [training.service.ts](file:///Users/kanishchev/Projects/trefix/backend/src/modules/training/training.service.ts)
- Implement `listWorkoutsForDateRange(actorUserId: string, fromDate: Date, toDate: Date): Promise<WorkoutView[]>`
  - Find athlete for `actorUserId`.
  - Query `Workout` records where `athleteId` = athlete.id and `scheduledAt` falls between `fromDate` and `toDate`.
- Implement `createWorkout(actorUserId: string, dto: CreateWorkoutDto): Promise<WorkoutView>`
  - Get or create athlete for `actorUserId`.
  - Construct `Workout` record (set `athleteId`, `scheduledAt`, `type`, `durationMinutes`, `distanceKm`, `status`).
  - If `dto.status === 'completed'` or `dto.actualDistanceKm` is provided:
    - Analyze workout using `trainingEngine.analyzeWorkout(...)`.
    - Set `workout.status = 'completed'`, populate `actual`, `analysis`, `completedAt`.
    - Create `TrainingLoad` entry.
    - Recalculate `AthleteState`.
  - Emit event `training.workout.created`.

#### [MODIFY] [training.controller.ts](file:///Users/kanishchev/Projects/trefix/backend/src:modules/training/training.controller.ts)
- Add `GET /workouts`:
  - Query params: `from` (string YYYY-MM-DD), `to` (string YYYY-MM-DD).
  - Calls `trainingService.listWorkoutsForDateRange(user.id, fromDate, toDate)`.
- Add `POST /workouts`:
  - Body: `CreateWorkoutDto`.
  - Calls `trainingService.createWorkout(user.id, dto)`.

---

### Shared API Client (`frontend/packages/api-client/`)

#### [MODIFY] [index.ts](file:///Users/kanishchev/Projects/trefix/frontend/packages/api-client/src/index.ts)
- Export Zod schemas for workout creation and filtering:
  - `createWorkoutSchema`
  - Export types `CreateWorkoutInput`

---

### Mobile App (`frontend/apps/mobile/`)

#### [MODIFY] [training-api.ts](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/lib/training-api.ts)
- Add `getWorkouts(from?: string, to?: string): Promise<TrainingWorkout[]>`
- Add `createWorkout(dto: CreateWorkoutInput): Promise<TrainingWorkout>`
- Add `completeWorkout(workoutId: string, dto: CompleteWorkoutInput): Promise<WorkoutCompletionResult>`

#### [NEW] [use-workouts.ts](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/main/hooks/use-workouts.ts)
- Implement `useWorkouts(from: string, to: string)` hook using `@tanstack/react-query` to fetch and cache workouts for range.
- Implement `useCreateWorkout()` mutation hook with query cache invalidation.
- Implement `useCompleteWorkout()` mutation hook with query cache invalidation.

#### [NEW] [add-workout-sheet.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/main/components/today/add-workout-sheet.tsx)
- Bottom sheet / modal for creating or logging a workout:
  - Mode selector: "Plan Workout" ("Запланировать") vs "Log Completed" ("Добавить выполненную").
  - Inputs for Date, Workout Type (Easy, Long Run, Tempo, Interval, Recovery, Hill, Race), Distance (km), Duration (min).
  - Extra inputs for completed runs: Pace, Heart Rate, RPE (1–10), Notes.
  - Form validation with feedback and loading state.

#### [NEW] [workout-detail-sheet.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/main/components/today/workout-detail-sheet.tsx)
- Bottom sheet for displaying workout details and completing planned workouts:
  - Header: Workout title, status badge, type icon.
  - For planned workouts: "Complete Workout" button allowing input of actual metrics (distance, duration, RPE, notes).
  - For completed workouts: Summary of actual performance, pace, HR, analysis feedback, and calculated training load.

#### [MODIFY] [today-screen.tsx](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/features/main/screens/today-screen.tsx)
- Connect real backend workouts via `useWorkouts`:
  - Calculate dynamic date range (e.g., current visible month/range) for query.
  - Transform `TrainingWorkout[]` into `Day[]` and `eventDates` array.
  - Render event dot markers in `TodayCalendarHeader`.
  - Handle tapping on events: open `WorkoutDetailSheet`.
  - Add "+ Add Workout" action button in header/screen to open `AddWorkoutSheet`.

#### [MODIFY] [ru.json](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/locales/main/ru.json) & [en.json](file:///Users/kanishchev/Projects/trefix/frontend/apps/mobile/src/locales/main/en.json)
- Add locale strings for workout creation, logging, completion, and metric labels.

---

## Verification Plan

### Automated Tests
- Run NestJS backend unit / integration tests:
  - `pnpm --filter backend test`
- Build workspace packages & check TypeScript typing:
  - `pnpm --filter @workspace/api-client build`
  - `pnpm --filter mobile typecheck`

### Manual Verification
1. Open mobile Today screen in simulator/device.
2. Select dates in the calendar header, verify event indicators update based on backend data.
3. Click "+ Add Workout", select "Log Completed Workout" for a past/current date, enter distance and duration, submit. Verify workout appears on Today screen with completed status and metrics.
4. Click "+ Add Workout", select "Plan Workout" for a future date, submit. Verify planned workout appears on calendar and timeline.
5. Tap a planned workout, select "Complete Workout", enter actual distance/time, submit. Verify status updates to completed.
