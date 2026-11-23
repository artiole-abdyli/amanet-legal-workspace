import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

/**
 * lib/storage reads STORAGE_DIR when the module first loads, so the temporary
 * directory has to be in place before the import.
 */
type Storage = typeof import("@/lib/storage");
let storage: Storage;
let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "hv-storage-"));
  process.env.STORAGE_DIR = root;
  storage = await import("@/lib/storage");
});

describe("document keys", () => {
  it("groups objects by matter and document", () => {
    expect(storage.documentKey("m1", "d1", 2)).toBe(
      "matters/m1/documents/d1/v2.pdf",
    );
  });
});

describe("storing and reading objects", () => {
  it("writes the bytes and reports their fingerprint", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const stored = await storage.putObject("matters/m1/a.pdf", bytes);

    expect(stored.byteSize).toBe(4);
    expect(stored.sha256).toBe(storage.sha256(bytes));
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);

    const onDisk = await readFile(path.join(root, "matters/m1/a.pdf"));
    expect(new Uint8Array(onDisk)).toEqual(bytes);
  });

  it("reads back exactly what was written", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    await storage.putObject("matters/m2/b.pdf", bytes);
    expect(new Uint8Array(await storage.getObject("matters/m2/b.pdf"))).toEqual(
      bytes,
    );
  });

  it("gives the same bytes the same fingerprint", () => {
    expect(storage.sha256(new Uint8Array([1, 2, 3]))).toBe(
      storage.sha256(new Uint8Array([1, 2, 3])),
    );
    expect(storage.sha256(new Uint8Array([1, 2, 3]))).not.toBe(
      storage.sha256(new Uint8Array([1, 2, 4])),
    );
  });
});

// A key is built partly from names that came from a client upload, so it must
// never be able to walk out of the storage directory.
describe("refusing keys that escape the storage root", () => {
  const escapes = [
    "../outside.pdf",
    "matters/../../outside.pdf",
    "matters/m1/../../../outside.pdf",
    "/etc/passwd",
  ];

  it("refuses to write them", async () => {
    for (const key of escapes) {
      await expect(
        storage.putObject(key, new Uint8Array([0])),
      ).rejects.toThrow(/storage root/);
    }
  });

  it("refuses to read them", async () => {
    for (const key of escapes) {
      await expect(storage.getObject(key)).rejects.toThrow(/storage root/);
    }
  });
});
