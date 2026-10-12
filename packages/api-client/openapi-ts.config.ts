import { defineConfig } from "@hey-api/openapi-ts";

/**
 * Generates the contract from the backend OpenAPI document. The document is
 * exported by the backend (`npm run openapi:export`) into `openapi/openapi.json`.
 */
export default defineConfig({
  input: "./openapi/openapi.json",
  output: { path: "./src/generated", postProcess: ["prettier"] },
  plugins: ["@hey-api/typescript", { name: "zod", compatibilityVersion: 4 }],
});
