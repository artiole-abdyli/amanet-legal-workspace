"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { DocumentFolder } from "@/app/generated/prisma/client";
import { assertMatterWritable, requireAdminActor } from "@/lib/admin";
import { folderLabel } from "@/lib/format";
import { LIMITS } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { deleteObject, putObject, uniqueDocumentKey } from "@/lib/storage";

const MAX_BYTES = 20 * 1024 * 1024;

function looksLikePdf(bytes: Uint8Array) {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return bytes.length > 5 && header.every((byte, i) => bytes[i] === byte);
}

/**
 * The firm's own upload.
 *
 * A file whose name already exists in the matter's Contracts folder becomes the
 * next version of that document rather than a second entry, which is how a
 * redraft keeps its history.
 *
 * A refusal sends the Admin back to the form with the reason in the URL, so the
 * page can say what was wrong instead of quietly doing nothing.
 */
export async function uploadMatterDocument(
  matterId: string,
  formData: FormData,
) {
  const { actor } = await requireAdminActor();
  await assertMatterWritable(matterId);

  const back = `/matters/${matterId}/upload?error=`;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`${back}missing`);
  if (file.size > MAX_BYTES) redirect(`${back}too-large`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) redirect(`${back}not-pdf`);

  // Bytes first, under a key no other upload can take; rows second, under a
  // lock on the matter, so two uploads of the same name cannot both become v2
  // or create two documents with one name.
  const candidateId = randomUUID();
  // Only used to file the bytes in the right directory; the decision about
  // which document they belong to is taken again under the lock.
  const likely = await prisma.document.findFirst({
    where: { matterId, folder: "CONTRACTS", name: file.name, archivedAt: null },
    select: { id: true },
  });
  const stored = await putObject(
    uniqueDocumentKey(matterId, likely?.id ?? candidateId),
    bytes,
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Matter" WHERE id = ${matterId} FOR UPDATE`;

      const existing = await tx.document.findFirst({
        where: { matterId, folder: "CONTRACTS", name: file.name, archivedAt: null },
        include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
      });

      const documentId = existing?.id ?? candidateId;
      if (!existing) {
        await tx.document.create({
          data: { id: documentId, matterId, folder: "CONTRACTS", name: file.name },
        });
      }

      const versionNo = (existing?.versions[0]?.versionNo ?? 0) + 1;

      await tx.documentVersion.create({
        data: {
          documentId,
          versionNo,
          storageKey: stored.key,
          sha256: stored.sha256,
          byteSize: stored.byteSize,
          uploadedByType: "ADMIN",
          uploadedByName: actor.actorName,
        },
      });
      await tx.activityEvent.create({
        data: {
          matterId,
          type: "DOCUMENT",
          summary:
            versionNo > 1
              ? `${file.name} v${versionNo} uploaded, earlier versions kept`
              : `${file.name} uploaded`,
          ...actor,
        },
      });
    });
  } catch (error) {
    await deleteObject(stored.key).catch(() => {});
    throw error;
  }

  revalidatePath(`/matters/${matterId}`);
  redirect(`/matters/${matterId}?tab=documents`);
}

/* ------------------------------------------------------------------------ */
/* Organising the library                                                    */
/* ------------------------------------------------------------------------ */

export type DocumentActionState = { ok: boolean; message?: string } | null;

/** The Admin may file documents in these; Signed is written only by signing. */
const MOVABLE: DocumentFolder[] = ["CONTRACTS", "CLIENT_UPLOADS"];

class Refused extends Error {}

async function loadDocument(documentId: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: { id: true, matterId: true, name: true, folder: true, archivedAt: true },
  });
  await assertMatterWritable(document.matterId);
  return document;
}

/**
 * Two live documents in one folder may not share a name: a firm upload with
 * that name would not know which one to version. Checked under a lock on the
 * matter, the same lock uploads take.
 */
async function assertNameFree(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  matterId: string,
  folder: DocumentFolder,
  name: string,
  exceptId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Matter" WHERE id = ${matterId} FOR UPDATE`;
  const clash = await tx.document.findFirst({
    where: { matterId, folder, name, archivedAt: null, id: { not: exceptId } },
    select: { id: true },
  });
  if (clash) {
    throw new Refused(
      `${folderLabel[folder]} already has a file called "${name}". Rename one of them first.`,
    );
  }
}

function refusal(error: unknown): DocumentActionState {
  if (error instanceof Refused) return { ok: false, message: error.message };
  throw error;
}

/** Renaming changes the label only; every stored version keeps its bytes and hash. */
export async function renameDocument(
  documentId: string,
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const { actor } = await requireAdminActor();
  let name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Give the document a name." };
  if (name.length > LIMITS.title) {
    return { ok: false, message: `Keep the name under ${LIMITS.title} characters.` };
  }
  if (!/\.pdf$/i.test(name)) name = `${name}.pdf`;

  const document = await loadDocument(documentId);
  if (name === document.name) return { ok: true };

  try {
    await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, document.matterId, document.folder, name, document.id);
      await tx.document.update({ where: { id: document.id }, data: { name } });
      await tx.activityEvent.create({
        data: {
          matterId: document.matterId,
          type: "DOCUMENT",
          summary: `Renamed ${document.name} to ${name}`,
          ...actor,
        },
      });
    });
  } catch (error) {
    return refusal(error);
  }

  revalidatePath(`/matters/${document.matterId}`);
  return { ok: true };
}

/**
 * Moves a document between Contracts and Client uploads, e.g. to send a file
 * the client provided out for signature. Signed records stay where signing put
 * them.
 */
export async function moveDocument(
  documentId: string,
  _previous: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const { actor } = await requireAdminActor();
  const folder = String(formData.get("folder") ?? "") as DocumentFolder;
  if (!MOVABLE.includes(folder)) return { ok: false, message: "Choose a folder." };

  const document = await loadDocument(documentId);
  if (document.folder === "SIGNED") {
    return { ok: false, message: "Signed records cannot be moved." };
  }
  if (document.folder === folder) return { ok: true };

  try {
    await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, document.matterId, folder, document.name, document.id);
      await tx.document.update({ where: { id: document.id }, data: { folder } });
      await tx.activityEvent.create({
        data: {
          matterId: document.matterId,
          type: "DOCUMENT",
          summary: `Moved ${document.name} to ${folderLabel[folder]}`,
          ...actor,
        },
      });
    });
  } catch (error) {
    return refusal(error);
  }

  revalidatePath(`/matters/${document.matterId}`);
  return { ok: true };
}

/**
 * Takes a document out of the library without deleting anything.
 *
 * Refused while something still depends on it: a signature request waiting
 * on one of its versions, or a client request it is the answer to. Signed
 * records are the firm's evidence and are never archived.
 */
export async function archiveDocument(
  documentId: string,
): Promise<DocumentActionState> {
  const { actor } = await requireAdminActor();
  const document = await loadDocument(documentId);
  if (document.folder === "SIGNED") {
    return { ok: false, message: "Signed records are kept in the library." };
  }

  const [liveSignature, openRequest] = await Promise.all([
    prisma.signatureRequest.findFirst({
      where: {
        documentVersion: { documentId },
        status: { in: ["SENT", "VIEWED", "STARTED"] },
      },
      select: { id: true },
    }),
    prisma.documentRequest.findFirst({
      where: {
        submittedDocumentId: documentId,
        status: { in: ["PENDING", "SUBMITTED", "CHANGES_REQUESTED"] },
      },
      select: { id: true },
    }),
  ]);
  if (liveSignature) {
    return {
      ok: false,
      message: "This document is out for signature. Revoke the request before archiving it.",
    };
  }
  if (openRequest) {
    return {
      ok: false,
      message: "This file answers an open client request. Accept or cancel the request first.",
    };
  }

  await prisma.$transaction([
    prisma.document.updateMany({
      where: { id: documentId, archivedAt: null },
      data: { archivedAt: new Date() },
    }),
    prisma.activityEvent.create({
      data: {
        matterId: document.matterId,
        type: "DOCUMENT",
        summary: `Archived ${document.name}; every version is kept`,
        ...actor,
      },
    }),
  ]);

  revalidatePath(`/matters/${document.matterId}`);
  return { ok: true };
}

export async function restoreDocument(
  documentId: string,
): Promise<DocumentActionState> {
  const { actor } = await requireAdminActor();
  const document = await loadDocument(documentId);
  if (!document.archivedAt) return { ok: true };

  try {
    await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, document.matterId, document.folder, document.name, document.id);
      await tx.document.update({ where: { id: document.id }, data: { archivedAt: null } });
      await tx.activityEvent.create({
        data: {
          matterId: document.matterId,
          type: "DOCUMENT",
          summary: `Restored ${document.name}`,
          ...actor,
        },
      });
    });
  } catch (error) {
    return refusal(error);
  }

  revalidatePath(`/matters/${document.matterId}`);
  return { ok: true };
}
