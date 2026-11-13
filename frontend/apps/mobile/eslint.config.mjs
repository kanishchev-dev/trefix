import baseConfig from "@trefix/eslint-config";

export default [
  ...baseConfig,
  {
    // Metro resolves static assets only through `require`.
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["src/lib/logger.ts"],
    rules: { "no-console": "off" },
  },
];
