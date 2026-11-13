import { logger } from "./logger";

/**
 * Helper utilities for parsing JWT tokens and inspecting claims (e.g. expiration)
 * without external binary dependencies.
 */

interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  userId?: string;
  email?: string;
  [key: string]: unknown;
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }

  if (typeof atob === "function") {
    return atob(base64);
  }

  // Fallback for JS runtimes without global atob
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < base64.length; i++) {
    const char = base64.charAt(i);
    if (char === "=") break;
    const index = chars.indexOf(char);
    if (index === -1) continue;

    buffer = (buffer << 6) | index;
    bitsCollected += 6;

    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      const byte = (buffer >> bitsCollected) & 0xff;
      output += String.fromCharCode(byte);
    }
  }

  return output;
}

/**
 * Parses and returns the decoded JSON payload of a JWT string.
 * Returns null if the token format is invalid or malformed.
 */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    const decodedStr = base64UrlDecode(parts[1]);
    return JSON.parse(decodedStr) as JwtPayload;
  } catch (error) {
    logger.warn("[jwt-utils] Failed to parse JWT payload:", error);
    return null;
  }
}

/**
 * Returns the expiration time of the JWT in milliseconds since epoch,
 * or null if no `exp` claim is present or token is invalid.
 */
export function getJwtExpirationMs(token: string): number | null {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return null;
  }
  return payload.exp * 1000;
}

/**
 * Checks if the given JWT token is expired (or will expire within bufferSeconds).
 */
export function isJwtExpired(token: string, bufferSeconds = 0): boolean {
  const expMs = getJwtExpirationMs(token);
  if (!expMs) {
    return false; // If no exp claim, assume valid until server rejects it
  }

  const nowMs = Date.now();
  const thresholdMs = expMs - bufferSeconds * 1000;
  return nowMs >= thresholdMs;
}
