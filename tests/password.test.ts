import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("accepts the password it was given", async () => {
    const stored = await hashPassword("workspace-demo");
    expect(await verifyPassword("workspace-demo", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("workspace-demo");
    expect(await verifyPassword("workspace-dem0", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("never stores the password itself", async () => {
    const stored = await hashPassword("workspace-demo");
    expect(stored).not.toContain("workspace-demo");
    expect(stored.startsWith("scrypt$")).toBe(true);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const a = await hashPassword("workspace-demo");
    const b = await hashPassword("workspace-demo");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("workspace-demo", b)).toBe(true);
  });

  it("returns false rather than throwing on a corrupt stored value", async () => {
    for (const broken of [
      "",
      "not-a-hash",
      "scrypt$16384$deadbeef",
      "bcrypt$16384$aa$bb",
      "scrypt$1$aa$bb",
      "scrypt$16384$$",
    ]) {
      expect(await verifyPassword("workspace-demo", broken)).toBe(false);
    }
  });
});
