import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { renderWebThemeCss } from "../../../../packages/tokens/src/web";

describe("admin theme", () => {
  it("is generated from the shared tokens", () => {
    const path = fileURLToPath(new URL("../../../../packages/ui/src/styles/theme.css", import.meta.url));
    // Out of date: run `pnpm --filter @workspace/tokens generate:web-css`.
    expect(readFileSync(path, "utf8")).toBe(renderWebThemeCss());
  });
});
