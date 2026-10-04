import { describe, expect, it } from "vitest";

import { shouldAutoOpenSection } from "./nav-main";

const BASE = {
  hasChildren: true,
  justGainedChildren: false,
  isActive: false,
  open: false,
  userToggled: false,
};

describe("shouldAutoOpenSection", () => {
  /**
   * The regression: a section whose submenu is filtered out until the session
   * resolves starts collapsed, and without this rule its children never showed
   * up — the menu looked permanently incomplete until a reload.
   */
  it("opens a section that just gained children", () => {
    expect(shouldAutoOpenSection({ ...BASE, justGainedChildren: true })).toBe(true);
  });

  it("opens the section the user is currently on", () => {
    expect(shouldAutoOpenSection({ ...BASE, isActive: true })).toBe(true);
  });

  it("leaves an unrelated, unchanged section alone", () => {
    expect(shouldAutoOpenSection(BASE)).toBe(false);
  });

  it("never fights the user after they closed it themselves", () => {
    expect(
      shouldAutoOpenSection({ ...BASE, userToggled: true, isActive: true }),
    ).toBe(false);
    expect(
      shouldAutoOpenSection({
        ...BASE,
        userToggled: true,
        justGainedChildren: true,
      }),
    ).toBe(false);
  });

  it("does nothing for a section with no submenu at all", () => {
    expect(
      shouldAutoOpenSection({
        hasChildren: false,
        justGainedChildren: true,
        isActive: true,
        open: false,
        userToggled: false,
      }),
    ).toBe(false);
  });

  it("does not re-open a section that is already open", () => {
    expect(shouldAutoOpenSection({ ...BASE, open: true, isActive: true })).toBe(false);
  });
});