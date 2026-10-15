/**
 * Live contract check: runs a scenario against a running backend and validates
 * every JSON response with the schema generated from the OpenAPI document.
 *
 * A response that fails to parse, or loses keys while parsing (zod strips
 * unknown keys), means the spec does not describe what the backend sends.
 *
 * Usage:
 *   CONTRACT_API_URL=http://localhost:3999 CONTRACT_EMAIL=… CONTRACT_PASSWORD=… pnpm contract:check
 *
 * The account needs admin permissions. The scenario creates and removes its own
 * data, but it does start and cancel a plan, so run it against a dev database.
 */
/* eslint-disable no-console -- a CLI report */
import { readFileSync } from "node:fs";

import type { ZodType } from "zod";

import * as contract from "../src/generated/zod.gen";
import { droppedKeys, isRecord } from "./dropped-keys";

const baseUrl = (
  process.env.CONTRACT_API_URL ?? "http://localhost:3999"
).replace(/\/$/, "");
const email = process.env.CONTRACT_EMAIL;
const password = process.env.CONTRACT_PASSWORD;

if (!email || !password) {
  console.error("Set CONTRACT_EMAIL and CONTRACT_PASSWORD");
  process.exit(2);
}

const schemas = contract as unknown as Record<string, ZodType | undefined>;

type Outcome = {
  operation: string;
  status: number;
  problems: string[];
};

const outcomes: Outcome[] = [];
let token = "";

function schemaName(operationId: string, kind: "Response" | "Body"): string {
  const pascal = operationId
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `z${pascal}${kind}`;
}

type OpenApiSchema = {
  $ref?: string;
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  allOf?: OpenApiSchema[];
};

const document = JSON.parse(
  readFileSync(new URL("../openapi/openapi.json", import.meta.url), "utf8"),
) as {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId: string;
        responses: Record<
          string,
          { content?: Record<string, { schema?: OpenApiSchema }> }
        >;
      }
    >
  >;
  components: { schemas: Record<string, OpenApiSchema> };
};

const responseSchemas = new Map<string, OpenApiSchema>();
for (const item of Object.values(document.paths)) {
  for (const operation of Object.values(item)) {
    for (const [code, response] of Object.entries(operation.responses)) {
      const schema = response.content?.["application/json"]?.schema;
      if (code.startsWith("2") && schema)
        responseSchemas.set(operation.operationId, schema);
    }
  }
}

/** Optional response properties (by DTO) and how often responses carried them. */
const optionalPresence = new Map<string, { present: number; total: number }>();

/** Walks a payload along its OpenAPI schema, counting the presence of optional properties. */
function trackOptional(
  schema: OpenApiSchema | undefined,
  value: unknown,
  owner = "inline",
): void {
  if (!schema) return;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() ?? "";
    trackOptional(document.components.schemas[name], value, name);
    return;
  }
  for (const part of schema.allOf ?? []) trackOptional(part, value, owner);
  if (schema.items && Array.isArray(value)) {
    for (const item of value) trackOptional(schema.items, item, owner);
  }
  if (!schema.properties || !isRecord(value)) return;
  for (const [key, property] of Object.entries(schema.properties)) {
    if (!schema.required?.includes(key)) {
      const id = `${owner}.${key}`;
      const stats = optionalPresence.get(id) ?? { present: 0, total: 0 };
      stats.total += 1;
      if (value[key] !== undefined) stats.present += 1;
      optionalPresence.set(id, stats);
    }
    trackOptional(property, value[key], owner);
  }
}

type CallOptions = {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Statuses that are valid outcomes of the scenario (default: any 2xx). */
  accept?: number[];
};

async function call<T = unknown>(
  operationId: string,
  method: string,
  path: string,
  options: CallOptions = {},
): Promise<T> {
  const problems: string[] = [];
  const bodySchema = schemas[schemaName(operationId, "Body")];
  if (options.body !== undefined && bodySchema) {
    const result = bodySchema.safeParse(options.body);
    if (!result.success)
      problems.push(
        `request body rejected by the contract: ${result.error.message}`,
      );
  }

  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.body !== undefined
        ? { "content-type": "application/json" }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : undefined;

  const accepted = options.accept ?? [];
  if (!response.ok && !accepted.includes(response.status)) {
    problems.push(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  } else if (response.ok) {
    const schema = schemas[schemaName(operationId, "Response")];
    if (!schema) {
      if (payload !== undefined)
        problems.push("no response schema in the contract");
    } else {
      const result = schema.safeParse(payload);
      if (!result.success) {
        problems.push(
          ...result.error.issues.map(
            (issue) => `${issue.path.join(".") || "$"}: ${issue.message}`,
          ),
        );
      } else {
        trackOptional(responseSchemas.get(operationId), payload);
        const dropped = droppedKeys(payload, result.data);
        if (dropped.length)
          problems.push(
            `keys dropped by the schema: ${dropped.slice(0, 10).join(", ")}`,
          );
      }
    }
  }

  outcomes.push({
    operation: `${operationId} ${method} ${path}`,
    status: response.status,
    problems,
  });
  if (!response.ok) throw new StepError(operationId, response.status);
  return payload as T;
}

class StepError extends Error {
  constructor(
    readonly operationId: string,
    readonly status: number,
  ) {
    super(`${operationId} failed with ${status}`);
  }
}

/** Runs a step; a failure is already recorded, so the scenario carries on. */
async function step(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (!(error instanceof StepError)) {
      outcomes.push({ operation: name, status: 0, problems: [String(error)] });
    }
  }
}

type Id = { id: string };
const today = new Date();
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
};
const nextMonday = () => {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
  return isoDate(date);
};
const timezone = "Europe/Moscow";
const unique = Date.now().toString(36);

const manualPlan = {
  goal: {
    type: "prepare_for_race",
    raceDistance: "10k",
    target: { distanceMeters: 10_000, finishTimeSec: 3000 },
    targetDate: addDays(70),
  },
  schedule: { trainingDays: [1, 3, 5], preferredLongRunDay: 5 },
  structure: { totalWeeks: 8, sessionsPerWeek: 3 },
  metrics: {
    thresholdPaceSecondsPerKm: 300,
    weeklyMileageKm: 25,
    longestRunKm: 12,
  },
  timezone,
};

async function main(): Promise<void> {
  // Auth
  const login = await call<{ accessToken: string; refreshToken: string }>(
    "AuthController_login_v1",
    "POST",
    "/v1/auth/login",
    { body: { email, password } },
  );
  token = login.accessToken;
  const me = await call<Id & { firstName: string }>(
    "AuthController_me_v1",
    "GET",
    "/v1/auth/me",
  );
  await step("updateMe", async () => {
    await call("AuthController_updateMe_v1", "PATCH", "/v1/auth/me", {
      body: { firstName: me.firstName },
    });
  });
  await step("refresh", async () => {
    const refreshed = await call<{ accessToken: string }>(
      "AuthController_refresh_v1",
      "POST",
      "/v1/auth/refresh",
      {
        body: { refreshToken: login.refreshToken },
      },
    );
    token = refreshed.accessToken;
  });

  // Users, permissions, settings
  await step("users", async () => {
    await call("UsersController_findAll_v1", "GET", "/v1/users", {
      query: { page: 1, limit: 5 },
    });
    await call("UsersController_getPresence_v1", "GET", "/v1/users/presence");
    await call("UsersController_findOne_v1", "GET", `/v1/users/${me.id}`);
    const created = await call<Id>(
      "UsersController_create_v1",
      "POST",
      "/v1/users",
      {
        body: {
          email: `contract-${unique}@example.com`,
          firstName: "Contract",
          lastName: "Check",
        },
      },
    );
    await call(
      "UsersController_update_v1",
      "PATCH",
      `/v1/users/${created.id}`,
      { body: { lastName: "Checked" } },
    );
    await step("invitation", async () => {
      await call(
        "UsersController_createInvitation_v1",
        "POST",
        `/v1/users/${created.id}/invitations`,
      );
    });
    await step("permissions", async () => {
      await call(
        "PermissionsController_findAllPermissions_v1",
        "GET",
        "/v1/permissions",
        { query: { limit: 5 } },
      );
      await call(
        "PermissionsController_findPermissionCatalog_v1",
        "GET",
        "/v1/permissions/catalog",
      );
      const permission = await call<Id>(
        "PermissionsController_createPermission_v1",
        "POST",
        "/v1/permissions",
        {
          body: {
            name: `contract.check.${unique}`,
            description: "Contract check",
          },
        },
      );
      await call(
        "PermissionsController_findPermission_v1",
        "GET",
        `/v1/permissions/${permission.id}`,
      );
      await call(
        "PermissionsController_updatePermission_v1",
        "PATCH",
        `/v1/permissions/${permission.id}`,
        {
          body: { description: "Contract check (updated)" },
        },
      );
      const groups = await call<unknown[]>(
        "PermissionsController_findAllGroups_v1",
        "GET",
        "/v1/permissions/groups",
      );
      void groups;
      const group = await call<Id>(
        "PermissionsController_createGroup_v1",
        "POST",
        "/v1/permissions/groups",
        {
          body: { name: `Contract ${unique}` },
        },
      );
      await call(
        "PermissionsController_findGroup_v1",
        "GET",
        `/v1/permissions/groups/${group.id}`,
      );
      await call(
        "PermissionsController_updateGroup_v1",
        "PATCH",
        `/v1/permissions/groups/${group.id}`,
        {
          body: { description: "Contract check" },
        },
      );
      const g = `/v1/permissions/groups/${group.id}/permissions/${permission.id}`;
      await call("PermissionsController_addPermissionToGroup_v1", "POST", g);
      const ug = `/v1/permissions/users/${created.id}/groups/${group.id}`;
      await call("PermissionsController_assignGroupToUser_v1", "POST", ug);
      const up = `/v1/permissions/users/${created.id}/permissions/${permission.id}`;
      await call("PermissionsController_assignPermissionToUser_v1", "POST", up);
      await call(
        "PermissionsController_getEffectivePermissions_v1",
        "GET",
        `/v1/permissions/users/${created.id}/effective`,
      );
      await call(
        "PermissionsController_revokePermissionFromUser_v1",
        "DELETE",
        up,
      );
      await call("PermissionsController_revokeGroupFromUser_v1", "DELETE", ug);
      await call(
        "PermissionsController_removePermissionFromGroup_v1",
        "DELETE",
        g,
      );
      await call(
        "PermissionsController_removeGroup_v1",
        "DELETE",
        `/v1/permissions/groups/${group.id}`,
      );
      await call(
        "PermissionsController_removePermission_v1",
        "DELETE",
        `/v1/permissions/${permission.id}`,
      );
    });
    await call(
      "UsersController_remove_v1",
      "DELETE",
      `/v1/users/${created.id}`,
    );
  });
  await step("settings", async () => {
    const settings = await call<{ theme: string }>(
      "SettingsController_getSettings_v1",
      "GET",
      "/v1/settings",
    );
    await call(
      "SettingsController_updateSettings_v1",
      "PATCH",
      "/v1/settings",
      { body: { theme: settings.theme } },
    );
  });

  // Athlete profile and preferences
  const athlete = await call<Id>(
    "AthletesController_getMe_v1",
    "GET",
    "/v1/athletes/me",
  );
  await step("athlete", async () => {
    await call("AthletesController_updateMe_v1", "PATCH", "/v1/athletes/me", {
      body: {},
    });
    await call(
      "TrainingController_getCurrentMetrics_v1",
      "GET",
      "/v1/athletes/me/current-metrics",
    );
    await call(
      "TrainingController_getAthlete_v1",
      "GET",
      `/v1/athletes/${athlete.id}`,
    );
    await call(
      "TrainingController_getAthleteState_v1",
      "GET",
      `/v1/athletes/${athlete.id}/state`,
    );
  });
  await step("preferences", async () => {
    const preferences = await call<{ units: string }>(
      "UserPreferencesController_get_v1",
      "GET",
      "/v1/me/preferences",
    );
    await call(
      "UserPreferencesController_update_v1",
      "PATCH",
      "/v1/me/preferences",
      {
        body: { units: preferences.units },
      },
    );
  });

  // Plans: draft, start, edit, rebuild, cancel
  let planId = "";
  await step("plans", async () => {
    await call(
      "TrainingController_previewManualPlan_v1",
      "POST",
      "/v1/plans/manual/preview",
      { body: manualPlan },
    );
    const draft = await call<{ plan: Id } & Partial<Id>>(
      "TrainingController_createManualPlan_v1",
      "POST",
      "/v1/plans/manual",
      {
        body: { ...manualPlan, name: `Contract ${unique}`, saveAsDraft: true },
      },
    );
    planId = draft.plan?.id ?? draft.id ?? "";
    await call("PlansController_list_v1", "GET", "/v1/plans", {
      query: { group: "draft" },
    });
    await call("PlansController_counts_v1", "GET", "/v1/plans/counts");
    const details = await call<{ version: number }>(
      "PlansController_getDetails_v1",
      "GET",
      `/v1/plans/${planId}`,
    );
    await call(
      "TrainingController_getPlanOverview_v1",
      "GET",
      `/v1/plans/${planId}/overview`,
    );
    await call(
      "PlansController_updateMeta_v1",
      "PATCH",
      `/v1/plans/${planId}`,
      {
        body: { notes: "Contract check", expectedVersion: details.version },
      },
    );
    await call(
      "PlansController_getStartOptions_v1",
      "GET",
      `/v1/plans/${planId}/start-options`,
      {
        query: { timezone },
      },
    );
    await call(
      "PlansController_start_v1",
      "POST",
      `/v1/plans/${planId}/start`,
      {
        body: { startDate: nextMonday(), replaceActive: true, timezone },
      },
    );
    await call("PlansController_getActive_v1", "GET", "/v1/plans/active");
    await call(
      "PlansController_listAdaptations_v1",
      "GET",
      "/v1/plans/active/adaptations",
    );
    const started = await call<{ version: number }>(
      "PlansController_getDetails_v1",
      "GET",
      `/v1/plans/${planId}`,
    );
    const changes = {
      kind: "schedule",
      expectedVersion: started.version,
      schedule: { trainingDays: [2, 4, 6], preferredLongRunDay: 6 },
      effectiveFrom: "next_week",
      timezone,
    };
    await call(
      "PlansController_previewChanges_v1",
      "POST",
      `/v1/plans/${planId}/changes/preview`,
      { body: changes },
    );
    await call(
      "PlansController_applyChanges_v1",
      "POST",
      `/v1/plans/${planId}/changes`,
      { body: changes },
    );
  });

  // Workouts, gear, progress
  await step("workouts", async () => {
    const workouts = await call<
      Array<Id & { status: string; scheduledAt: string }>
    >("TrainingController_getWorkouts_v1", "GET", "/v1/workouts", {
      query: { from: addDays(-30), to: addDays(90) },
    });
    const planned = workouts.find((workout) => workout.status === "planned");
    const extra = await call<Id>(
      "TrainingController_createWorkout_v1",
      "POST",
      "/v1/workouts",
      {
        body: {
          scheduledAt: `${addDays(1)}T07:00:00.000Z`,
          type: "easy",
          durationMinutes: 40,
          distanceKm: 7,
        },
      },
    );
    const workoutId = extra.id;
    await call(
      "TrainingController_getWorkout_v1",
      "GET",
      `/v1/workouts/${workoutId}`,
    );
    if (planned) {
      await call(
        "WorkoutExecutionController_getExecution_v1",
        "GET",
        `/v1/workouts/${planned.id}/execution`,
      );
    }
    await call(
      "TrainingController_completeWorkout_v1",
      "POST",
      `/v1/workouts/${workoutId}/complete`,
      {
        body: {
          actualDurationMinutes: 41,
          actualDistanceKm: 7.1,
          actualAverageHeartRate: 142,
          rpe: 4,
        },
      },
    );
    await call(
      "DeviceIntegrationsController_listWorkoutSources_v1",
      "GET",
      `/v1/integrations/workouts/${workoutId}/sources`,
    );
    await step("recording", async () => {
      await call(
        "RecordingsController_getRecording_v1",
        "GET",
        `/v1/workouts/${workoutId}/recording`,
        {
          accept: [404],
        },
      );
    });

    await step("gear", async () => {
      const gear = await call<
        Id & { limitKm: number; initialDistanceKm: number }
      >("GearController_create_v1", "POST", "/v1/gear", {
        body: {
          brand: "Contract",
          model: unique,
          initialDistanceKm: 120,
          limitKm: 900,
        },
      });
      await call("GearController_list_v1", "GET", "/v1/gear");
      await call("GearController_get_v1", "GET", `/v1/gear/${gear.id}`);
      const updated = await call<{
        limitKm: number;
        initialDistanceKm: number;
      }>("GearController_update_v1", "PATCH", `/v1/gear/${gear.id}`, {
        body: { nickname: "Contract" },
      });
      if (updated.limitKm !== 900 || updated.initialDistanceKm !== 120) {
        outcomes.push({
          operation: "GearController_update_v1 (partial update)",
          status: 200,
          problems: [
            `PATCH reset unspecified fields: limitKm=${updated.limitKm}, initialDistanceKm=${updated.initialDistanceKm}`,
          ],
        });
      }
      await call(
        "GearController_assign_v1",
        "PATCH",
        `/v1/workouts/${workoutId}/gear`,
        { body: { gearId: gear.id } },
      );
      await call(
        "GearController_retire_v1",
        "POST",
        `/v1/gear/${gear.id}/retire`,
      );
      await call(
        "GearController_restore_v1",
        "POST",
        `/v1/gear/${gear.id}/restore`,
      );
      await call(
        "GearController_assign_v1",
        "PATCH",
        `/v1/workouts/${workoutId}/gear`,
        { body: { gearId: null } },
      );
      await call("GearController_remove_v1", "DELETE", `/v1/gear/${gear.id}`);
    });

    await step("progress", async () => {
      await call(
        "ProgressController_overview_v1",
        "GET",
        "/v1/progress/overview",
        { query: { period: "3M" } },
      );
      await call(
        "ProgressController_summary_v1",
        "GET",
        "/v1/progress/summary",
        { query: { timezone: "Europe/Moscow" } },
      );
      await call(
        "ProgressController_metric_v1",
        "GET",
        "/v1/progress/metrics/threshold_pace",
        { query: { period: "6M" } },
      );
      await call(
        "ProgressController_metric_v1",
        "GET",
        "/v1/progress/metrics/vo2max",
      );
      await call(
        "ProgressController_records_v1",
        "GET",
        "/v1/progress/records",
      );
      const result = await call<{ result?: Id } & Partial<Id>>(
        "ProgressController_addResult_v1",
        "POST",
        "/v1/progress/results",
        {
          body: {
            distanceM: 5000,
            timeSeconds: 1400,
            date: addDays(-3),
            kind: "test",
            name: "Contract",
          },
        },
      );
      await call(
        "ProgressController_recordHistory_v1",
        "GET",
        "/v1/progress/records/5k",
      );
      await call(
        "ProgressController_setRecordsExcluded_v1",
        "PATCH",
        `/v1/workouts/${workoutId}/records`,
        {
          body: { excluded: true },
        },
      );
      const resultId = result.result?.id ?? result.id;
      if (resultId)
        await call(
          "ProgressController_deleteResult_v1",
          "DELETE",
          `/v1/progress/results/${resultId}`,
        );
    });
  });

  if (planId) {
    await step("cancel plan", async () => {
      await call(
        "PlansController_cancel_v1",
        "POST",
        `/v1/plans/${planId}/cancel`,
        { body: { timezone } },
      );
      await call("PlansController_list_v1", "GET", "/v1/plans", {
        query: { group: "history" },
      });
      await call(
        "PlansController_rebuildPrefill_v1",
        "GET",
        `/v1/plans/${planId}/rebuild/prefill`,
      );
      const rebuild = { ...manualPlan, target: "new_draft" };
      await call(
        "PlansController_rebuildPreview_v1",
        "POST",
        `/v1/plans/${planId}/rebuild/preview`,
        { body: rebuild },
      );
      const rebuilt = await call<{ plan?: Id; planId?: string }>(
        "PlansController_rebuild_v1",
        "POST",
        `/v1/plans/${planId}/rebuild`,
        {
          body: { ...rebuild, saveAsDraft: true },
        },
      );
      const rebuiltId = rebuilt.plan?.id ?? rebuilt.planId;
      if (rebuiltId)
        await call(
          "PlansController_delete_v1",
          "DELETE",
          `/v1/plans/${rebuiltId}`,
        );
    });
  }

  // Admin views of the same athlete
  await step("admin training", async () => {
    const base = `/v1/users/${me.id}/training`;
    await call("AdminPlansController_counts_v1", "GET", `${base}/plans/counts`);
    await call("AdminPlansController_list_v1", "GET", `${base}/plans`, {
      query: { group: "history" },
    });
    await call(
      "AdminPlansController_currentMetrics_v1",
      "GET",
      `${base}/current-metrics`,
    );
    await call(
      "AdminPlansController_previewManualPlan_v1",
      "POST",
      `${base}/plans/manual/preview`,
      { body: manualPlan },
    );
    const draft = await call<{ plan?: Id } & Partial<Id>>(
      "AdminPlansController_createManualPlan_v1",
      "POST",
      `${base}/plans/manual`,
      {
        body: { ...manualPlan, saveAsDraft: true },
      },
    );
    const id = draft.plan?.id ?? draft.id;
    const details = await call<{ version: number }>(
      "AdminPlansController_getDetails_v1",
      "GET",
      `${base}/plans/${id}`,
    );
    await call(
      "AdminPlansController_updateMeta_v1",
      "PATCH",
      `${base}/plans/${id}`,
      {
        body: { name: "Contract (admin)", expectedVersion: details.version },
      },
    );
    await call(
      "AdminPlansController_startOptions_v1",
      "GET",
      `${base}/plans/${id}/start-options`,
    );
    await call(
      "AdminPlansController_delete_v1",
      "DELETE",
      `${base}/plans/${id}`,
    );

    await call(
      "AdminTrainingController_getCalendarSummary_v1",
      "GET",
      `${base}/calendar/summary`,
      {
        query: { from: addDays(-7), to: addDays(28), timezone },
      },
    );
    await call(
      "AdminTrainingController_getCalendarDay_v1",
      "GET",
      `${base}/calendar`,
      {
        query: { date: isoDate(today), timezone },
      },
    );
    const created = await call<{ workout: Id }>(
      "AdminTrainingController_createWorkout_v1",
      "POST",
      `${base}/workouts`,
      {
        body: {
          scheduledAt: `${addDays(2)}T07:00:00.000Z`,
          type: "easy",
          durationMinutes: 30,
          distanceKm: 5,
        },
      },
    );
    await call(
      "AdminTrainingController_updateWorkout_v1",
      "PATCH",
      `${base}/workouts/${created.workout.id}`,
      {
        body: { status: "skipped" },
      },
    );
  });

  // Coach
  await step("coach", async () => {
    await call(
      "CoachController_getLatestSession_v1",
      "GET",
      "/v1/coach/sessions/latest",
      { accept: [404] },
    );
    const session = await call<Id>(
      "CoachController_createSession_v1",
      "POST",
      "/v1/coach/sessions",
      {
        body: { athleteId: athlete.id, title: "Contract" },
      },
    );
    await call(
      "CoachController_getSession_v1",
      "GET",
      `/v1/coach/sessions/${session.id}`,
    );
    await call(
      "CoachController_clearHistory_v1",
      "DELETE",
      "/v1/coach/sessions",
    );
  });

  // Integrations and consents
  await step("integrations", async () => {
    await call(
      "IntegrationsController_listIntegrations_v1",
      "GET",
      "/v1/integrations",
    );
    await call(
      "IntegrationsController_getStravaIntegration_v1",
      "GET",
      "/v1/integrations/strava",
    );
    await call(
      "IntegrationsController_getStravaSyncStatus_v1",
      "GET",
      "/v1/integrations/strava/sync",
    );
    const consents = await call<{ currentVersions: { health_data: string } }>(
      "UserConsentsController_list_v1",
      "GET",
      "/v1/me/consents",
    );
    await call("UserConsentsController_give_v1", "POST", "/v1/me/consents", {
      body: {
        type: "health_data",
        version: consents.currentVersions.health_data,
      },
    });
    await call(
      "DeviceIntegrationsController_connect_v1",
      "PUT",
      "/v1/integrations/apple_health/connection",
      {
        body: {
          platform: "ios",
          deviceId: `contract-${unique}`,
          grantedScopes: ["workouts", "heart_rate"],
        },
      },
    );
    await call(
      "DeviceIntegrationsController_getSyncStatus_v1",
      "GET",
      "/v1/integrations/apple_health/sync",
    );
    await call(
      "DeviceIntegrationsController_disconnect_v1",
      "DELETE",
      "/v1/integrations/apple_health",
    );
    await call(
      "UserConsentsController_revoke_v1",
      "DELETE",
      "/v1/me/consents/health_data",
    );
  });

  await step("logout", async () => {
    await call("AuthController_logout_v1", "POST", "/v1/auth/logout");
  });
}

function report(): number {
  const alwaysPresent = [...optionalPresence.entries()]
    .filter(([, stats]) => stats.present === stats.total)
    .map(([path]) => path);
  if (alwaysPresent.length && process.env.CONTRACT_VERBOSE) {
    console.log("Optional in the contract, but present in every response:");
    for (const path of alwaysPresent) console.log(`  ${path}`);
    console.log("");
  }
  const failed = outcomes.filter((outcome) => outcome.problems.length);
  for (const outcome of outcomes) {
    const mark = outcome.problems.length ? "✗" : "✓";
    console.log(`${mark} ${outcome.status} ${outcome.operation}`);
    for (const problem of outcome.problems) console.log(`    ${problem}`);
  }
  const covered = new Set(
    outcomes.map((outcome) => outcome.operation.split(" ")[0]),
  );
  console.log(
    `\n${outcomes.length} calls, ${covered.size} operations, ${failed.length} with problems`,
  );
  return failed.length ? 1 : 0;
}

main()
  .catch((error: unknown) => {
    if (!(error instanceof StepError))
      outcomes.push({
        operation: "scenario",
        status: 0,
        problems: [String(error)],
      });
  })
  .finally(() => {
    process.exitCode = report();
  });
