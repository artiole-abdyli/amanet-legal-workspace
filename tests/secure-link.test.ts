import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSecureToken,
  hashSecureToken,
  signUrl,
  uploadUrl,
} from "@/lib/secure-link";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("secure link tokens", () => {
  it("issues a different token every time", () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => createSecureToken()),
    );
    expect(tokens.size).toBe(50);
  });

  it("issues tokens with 32 bytes of entropy, URL safe", () => {
    const token = createSecureToken();
    expect(Buffer.from(token, "base64url").byteLength).toBe(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes the same token to the same value", () => {
    vi.stubEnv("SECURE_LINK_PEPPER", "pepper-one");
    const token = createSecureToken();
    expect(hashSecureToken(token)).toBe(hashSecureToken(token));
  });

  it("never leaves the token recoverable from the hash", () => {
    vi.stubEnv("SECURE_LINK_PEPPER", "pepper-one");
    const token = createSecureToken();
    const hash = hashSecureToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives two tokens two different hashes", () => {
    vi.stubEnv("SECURE_LINK_PEPPER", "pepper-one");
    expect(hashSecureToken(createSecureToken())).not.toBe(
      hashSecureToken(createSecureToken()),
    );
  });

  // This is the property that makes a stolen database useless: without the
  // application secret, the stored hashes cannot be matched to any link.
  it("produces a different hash under a different pepper", () => {
    const token = createSecureToken();

    vi.stubEnv("SECURE_LINK_PEPPER", "pepper-one");
    const first = hashSecureToken(token);

    vi.stubEnv("SECURE_LINK_PEPPER", "pepper-two");
    const second = hashSecureToken(token);

    expect(first).not.toBe(second);
  });
});

describe("link urls", () => {
  it("builds signing and upload urls from APP_URL", () => {
    vi.stubEnv("APP_URL", "https://workspace.example");
    expect(signUrl("abc")).toBe("https://workspace.example/sign/abc");
    expect(uploadUrl("abc")).toBe("https://workspace.example/upload/abc");
  });
});
