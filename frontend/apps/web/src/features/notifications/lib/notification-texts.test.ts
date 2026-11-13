import { describe, expect, it } from "vitest";

import {
  broadcastText,
  notificationBody,
  notificationTitle,
  percent,
} from "./notification-texts";

const dictionary: Record<string, string> = {
  "notifications.categories.coach": "Tref",
  "notifications.types.coach_message": "Message from Tref",
};
const t = (key: string): string => dictionary[key] ?? key;

describe("notification texts", () => {
  it("falls back to the sender of the category and the type name", () => {
    expect(notificationTitle({ title: null, category: "coach" }, t)).toBe(
      "Tref",
    );
    expect(notificationTitle({ title: "Hi", category: "coach" }, t)).toBe("Hi");
    expect(notificationBody({ body: null, type: "coach.message" }, t)).toBe(
      "Message from Tref",
    );
    expect(notificationBody({ body: null, type: "future.kind" }, t)).toBe(
      "future.kind",
    );
  });

  it("shows the broadcast in the admin language or the other one", () => {
    const content = { ru: { title: null, body: "Привет" } };
    expect(broadcastText({ content }, "en")).toEqual({
      title: null,
      body: "Привет",
    });
  });

  it("computes shares without dividing by zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});
