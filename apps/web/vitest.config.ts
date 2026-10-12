import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const viteConfig = defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
  resolve: {
    alias: [
      {
        find: "@trefix/api-client",
        replacement: fileURLToPath(
          new URL("../../packages/api-client/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@trefix\/ui(\/.*)?$/,
        replacement: fileURLToPath(
          new URL("../../packages/ui/src$1", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
});

export default viteConfig;
