import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directoryName = dirname(fileURLToPath(import.meta.url));

/**
 * Baseline hardening for an authenticated admin. A Content-Security-Policy is
 * left for later: the theme bootstrap in the root layout is an inline script
 * and needs a nonce first.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  outputFileTracingRoot: join(directoryName, "../../"),
  transpilePackages: [
    "@workspace/api-client",
    "@workspace/config",
    "@workspace/tokens",
    "@workspace/ui",
    "@workspace/utils",
  ],
};

export default nextConfig;
