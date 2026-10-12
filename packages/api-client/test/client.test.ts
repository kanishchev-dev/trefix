import { afterEach, describe, expect, it, vi } from "vitest";

import { droppedKeys } from "../contract/dropped-keys";
import {
  ApiClientError,
  authUserSchema,
  coachMessageSchema,
  createApiClient,
  deriveLegacyRaceFields,
  mapLegacyRaceGoal,
  metricsSourceSchema,
  planDetailsSchema,
  previewWeekPhase,
  previewWorkoutPhase,
  validateGoalPayload,
  WORKOUT_STATUSES,
} from "../src";

const request = createApiClient({ baseUrl: "https://api.test" });

function respond(status: number, body?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      body === undefined
        ? new Response(null, { status })
        : new Response(JSON.stringify(body), { status }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("createApiClient", () => {
  it("parses JSON and sends the JSON content type", async () => {
    respond(200, { ok: true });
    await expect(request("/v1/x")).resolves.toEqual({ ok: true });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://api.test/v1/x");
    expect(new Headers(init?.headers).get("content-type")).toBe(
      "application/json",
    );
  });

  it("returns undefined for empty bodies, 204 or not", async () => {
    respond(204);
    await expect(request("/v1/x")).resolves.toBeUndefined();
    respond(200);
    await expect(request("/v1/x")).resolves.toBeUndefined();
  });

  it("turns error bodies into ApiClientError", async () => {
    respond(409, {
      statusCode: 409,
      code: "PLAN_VERSION_CONFLICT",
      message: "Plan changed",
    });
    const error = await request("/v1/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 409,
      code: "PLAN_VERSION_CONFLICT",
      message: "Plan changed",
    });
  });

  it("keeps a readable message when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Bad gateway", { status: 502 })),
    );
    await expect(request("/v1/x")).rejects.toMatchObject({
      status: 502,
      message: "Request failed with status 502",
    });
  });
});

describe("contract schemas", () => {
  it("fills client defaults of the current user", () => {
    const user = authUserSchema.parse({
      id: "u1",
      email: "runner@example.com",
      emailVerified: true,
    });
    expect(user).toMatchObject({
      firstName: "",
      lastName: "",
      features: { showReferral: false },
    });
  });

  it("normalizes missing coach message metadata to an object", () => {
    const message = coachMessageSchema.parse({
      id: "m1",
      sessionId: "s1",
      role: "assistant",
      content: "Hi",
      metadata: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(message.metadata).toEqual({});
  });

  it("accepts every metrics source the backend reports", () => {
    expect(metricsSourceSchema.parse("user_input")).toBe("user_input");
    expect(() => metricsSourceSchema.parse("guess")).toThrow();
  });

  it("knows only the workout statuses the backend stores", () => {
    expect([...WORKOUT_STATUSES].sort()).toEqual(
      ["cancelled", "completed", "planned", "skipped"].sort(),
    );
  });

  it("rejects plan details without the fields the backend always sends", () => {
    const result = planDetailsSchema.safeParse({ id: "p1", name: "Plan" });
    expect(result.success).toBe(false);
  });
});

describe("preview phases", () => {
  it("maps engine phases to the typed preview phases", () => {
    expect(previewWorkoutPhase("Build")).toBe("build");
    expect(previewWeekPhase("taper")).toBe("TAPER");
  });

  it("falls back to base for unknown phases", () => {
    expect(previewWorkoutPhase("")).toBe("base");
    expect(previewWeekPhase("unknown")).toBe("BASE");
  });
});

describe("goal helpers", () => {
  it("requires the race distance for race goals", () => {
    expect(validateGoalPayload({ type: "prepare_for_race" })).toMatchObject({
      valid: false,
      code: "GOAL_TARGET_REQUIRED",
    });
    expect(
      validateGoalPayload({
        type: "prepare_for_race",
        target: { distanceMeters: 10_000 },
      }),
    ).toEqual({ valid: true });
  });

  it("round-trips legacy race fields", () => {
    const goal = mapLegacyRaceGoal("half_marathon", 6300);
    expect(goal).toEqual({
      type: "improve_race_result",
      target: { distanceMeters: 21_097, finishTimeSec: 6300 },
    });
    expect(deriveLegacyRaceFields(goal)).toEqual({
      raceDistance: "half_marathon",
      targetTimeSeconds: 6300,
    });
  });
});

describe("droppedKeys", () => {
  it("reports keys lost while parsing, nested and in arrays", () => {
    expect(
      droppedKeys(
        { a: 1, b: { c: 2, d: 3 }, list: [{ e: 1, f: 2 }], gone: undefined },
        { a: 1, b: { c: 2 }, list: [{ e: 1 }] },
      ),
    ).toEqual(["$.b.d", "$.list[0].f"]);
  });
});
