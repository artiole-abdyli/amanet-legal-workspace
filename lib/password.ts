import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify loses the overload that takes options, so the shape is restated here.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const COST = 16384; // 2^14

/**
 * Hashes a password with scrypt, which ships with Node, so the project does not
 * depend on a native module to build. The salt is stored alongside the hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH, {
    N: COST,
  })) as Buffer;
  return `scrypt$${COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Compares in constant time. Returns false rather than throwing on a malformed
 * stored value, so a corrupt row cannot be told apart from a wrong password.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;

  const cost = Number(parts[1]);
  if (!Number.isInteger(cost) || cost < 1024) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[2], "hex");
    expected = Buffer.from(parts[3], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

  const derived = (await scryptAsync(password, salt, KEY_LENGTH, {
    N: cost,
  })) as Buffer;

  return timingSafeEqual(derived, expected);
}
