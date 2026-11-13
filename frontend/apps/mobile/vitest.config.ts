import { defineConfig } from "vitest/config";

/** Unit tests for pure modules (mappers, sync engine); they must not import react-native. */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
