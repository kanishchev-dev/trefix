import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { renderWebThemeCss } from "../../../../packages/tokens/src/web";

describe("admin theme", () => {
  it("is generated from the shared tokens", () => {
    // Resolved from the file path: under happy-dom `import.meta.url` is not a file URL.
    const path = resolve(
      __dirname,
      "../../../../packages/ui/src/styles/theme.css",
    );
    // Out of date: run `pnpm --filter @trefix/tokens generate:web-css`.
    expect(readFileSync(path, "utf8")).toBe(renderWebThemeCss());
  });
});
