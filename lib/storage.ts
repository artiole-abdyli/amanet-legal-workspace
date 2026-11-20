import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage behind a small interface.
 *
 * The local adapter writes to STORAGE_DIR, which keeps development and review
 * free of extra services. Swapping in S3 or R2 means implementing `putObject`
 * and `getObject` against the SDK; nothing above this module knows where the
 * bytes live, it only holds a storage key.
 *
 * The `turbopackIgnore` comments tell the bundler not to trace these paths.
 * They are resolved from an environment variable at runtime, so static analysis
 * cannot scope them and would otherwise pull the whole project into the server
 * bundle.
 */

const root = path.resolve(
  /* turbopackIgnore: true */ process.env.STORAGE_DIR ?? "./.storage",
);

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Resolves a key inside the storage root and refuses anything that would escape
 * it, so a key built from a user-supplied name can never reach the filesystem
 * outside STORAGE_DIR.
 */
function resolveKey(key: string): string {
  const full = path.resolve(root, key);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(rootWithSep)) {
    throw new Error(`Refusing storage key outside the storage root: ${key}`);
  }
  return full;
}

export type StoredObject = {
  key: string;
  sha256: string;
  byteSize: number;
};

export async function putObject(
  key: string,
  bytes: Uint8Array,
): Promise<StoredObject> {
  const full = resolveKey(key);
  await mkdir(/* turbopackIgnore: true */ path.dirname(full), {
    recursive: true,
  });
  await writeFile(/* turbopackIgnore: true */ full, bytes);
  return { key, sha256: sha256(bytes), byteSize: bytes.byteLength };
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(/* turbopackIgnore: true */ resolveKey(key));
}

/** Keys are grouped by matter so the storage directory is readable by hand. */
export function documentKey(
  matterId: string,
  documentId: string,
  versionNo: number,
): string {
  return `matters/${matterId}/documents/${documentId}/v${versionNo}.pdf`;
}
