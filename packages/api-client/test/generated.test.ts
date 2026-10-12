import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@hey-api/openapi-ts";
import { afterAll, describe, expect, it } from "vitest";

import config from "../openapi-ts.config";

const root = fileURLToPath(new URL("..", import.meta.url));
const committed = join(root, "src/generated");
const fresh = mkdtempSync(join(tmpdir(), "api-contract-"));

afterAll(() => rmSync(fresh, { recursive: true, force: true }));

describe("generated contract", () => {
  it("matches the committed OpenAPI document", async () => {
    await createClient({
      ...config,
      input: join(root, "openapi/openapi.json"),
      output: { path: fresh, postProcess: ["prettier"] },
      logs: { level: "silent" },
    });

    const files = readdirSync(committed).sort();
    expect(readdirSync(fresh).sort()).toEqual(files);
    for (const file of files) {
      expect(
        readFileSync(join(fresh, file), "utf8"),
        `${file} is stale: run \`pnpm --filter @workspace/api-client generate\``,
      ).toBe(readFileSync(join(committed, file), "utf8"));
    }
  }, 60_000);
});
