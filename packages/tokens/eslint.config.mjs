import baseConfig from "@workspace/eslint-config";

export default [
  ...baseConfig,
  {
    // Build-time generator: prints where it wrote the CSS.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
];
