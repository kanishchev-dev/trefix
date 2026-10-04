import { describe, expect, it } from "vitest";

import { toInitials } from "./initials";

describe("toInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(toInitials("Иван Петров")).toBe("ИП");
    expect(toInitials("John Doe")).toBe("JD");
  });

  it("takes a single letter from a one word name", () => {
    expect(toInitials("Cher")).toBe("C");
  });

  it("ignores extra whitespace", () => {
    expect(toInitials("  Иван   Петров  ")).toBe("ИП");
  });

  it("takes two words even when the name is longer", () => {
    expect(toInitials("Иван Петров Сергеевич")).toBe("ИП");
  });

  it("falls back when there is nothing to take a letter from", () => {
    expect(toInitials("")).toBe("U");
    expect(toInitials("   ")).toBe("U");
    expect(toInitials("", "?")).toBe("?");
  });
});