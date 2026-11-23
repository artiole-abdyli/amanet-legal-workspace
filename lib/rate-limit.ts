import { headers } from "next/headers";

/**
 * A fixed-window limiter held in memory.
 *
 * It is deliberately the simplest thing that closes the hole: repeated
 * password guesses, and a client link being hammered with uploads. One process
 * keeps one map, so behind several instances each would count separately —
 * fine for a single-firm deployment, and the reason the real answer is Redis
 * or the platform's own limiter once there is more than one server.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Keeps the map from growing without bound in a long-running process. */
function prune(now: number) {
  if (windows.size < 500) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets, for the message shown to the caller. */
  retryAfter: number;
};

/**
 * Whether the key is already over its limit, without spending an attempt.
 *
 * Checking and counting are separate so a caller can count only the attempts
 * worth counting. A correct password should not use up the budget that exists
 * to slow down wrong ones.
 */
export function isRateLimited(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const current = windows.get(key);

  if (!current || current.resetAt <= now) return { ok: true, retryAfter: 0 };

  return {
    ok: current.count < limit,
    retryAfter: Math.ceil((current.resetAt - now) / 1000),
  };
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  current.count += 1;
  const retryAfter = Math.ceil((current.resetAt - now) / 1000);

  return { ok: current.count <= limit, retryAfter };
}

/**
 * A key for the caller's address.
 *
 * Only meaningful behind a proxy that overwrites `x-forwarded-for`. Served
 * directly, the header is whatever the client sends, so this must not be the
 * only thing standing between an attacker and a password: anything guarding a
 * secret keys on the account instead. It is never used to decide who someone
 * is.
 */
export async function callerKey(prefix: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${prefix}:${forwarded || headerList.get("x-real-ip") || "local"}`;
}

/** Minutes, for the message a blocked caller sees. */
export function waitMessage(retryAfter: number): string {
  if (retryAfter <= 60) return "Try again in a minute.";
  return `Try again in ${Math.ceil(retryAfter / 60)} minutes.`;
}
