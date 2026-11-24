import { createHash, randomBytes } from "node:crypto";

/**
 * Secure links are capabilities, not sessions.
 *
 * A token is 32 random bytes. It is shown exactly once, in the email, and only
 * its hash is stored. The hash is taken over SECURE_LINK_PEPPER + token, so a
 * leaked database still cannot be turned into working links without the
 * application secret.
 *
 * Nothing about a link identifies the holder, so every check happens on the
 * server: purpose, expiry, revocation, and single use where it applies.
 */

function pepper(): string {
  const value = process.env.SECURE_LINK_PEPPER;
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SECURE_LINK_PEPPER must be set in production");
    }
    return "development-pepper";
  }
  return value;
}

export function createSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecureToken(token: string): string {
  return createHash("sha256").update(`${pepper()}:${token}`).digest("hex");
}

export function signUrl(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/sign/${token}`;
}

export function uploadUrl(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/upload/${token}`;
}

/**
 * How long a signer can download their signed copy after signing. The signing
 * link itself is spent the moment it is used; this window only ever grants a
 * read of the finished PDF, never another signature.
 */
export const SIGNED_COPY_DAYS = 30;

export function signedCopyUrl(token: string): string {
  return `${signUrl(token)}/signed`;
}
