"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { openUploadLink } from "@/lib/link-access";
import { prisma } from "@/lib/prisma";
import { rateLimit, waitMessage } from "@/lib/rate-limit";
import { deleteObject, putObject, uniqueDocumentKey } from "@/lib/storage";

export type UploadOutcome = { ok: true } | { ok: false; message: string };

const MAX_BYTES = 20 * 1024 * 1024;

class AlreadyAccepted extends Error {}
class Cancelled extends Error {}

/** A PDF always starts with these five bytes, whatever the file is named. */
function looksLikePdf(bytes: Uint8Array) {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  return bytes.length > 5 && header.every((byte, i) => bytes[i] === byte);
}

export async function submitClientUpload(
  token: string,
  formData: FormData,
): Promise<UploadOutcome> {
  // Keyed on the link rather than the address: the upload accepts 20 MB a
  // time, and the link is the thing being abused.
  const limit = rateLimit(`upload:${token}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Too many uploads from this link. ${waitMessage(limit.retryAfter)}`,
    };
  }

  const result = await openUploadLink(token);
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "expired"
          ? "This upload link has expired. Ask your lawyer for a new one."
          : result.reason === "revoked"
            ? "This upload link was cancelled by the firm."
            : "This upload link is no longer valid.",
    };
  }

  const request = result.target;
  if (request.status === "ACCEPTED") {
    return {
      ok: false,
      message: "Your lawyer has already accepted this document.",
    };
  }
  if (request.status === "CANCELLED") {
    return { ok: false, message: "The firm cancelled this upload request." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a PDF file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      message: `That file is ${(file.size / 1_048_576).toFixed(1)} MB. Files must be 20 MB or smaller.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) {
    return {
      ok: false,
      message: "That file is not a PDF. Please upload a PDF document.",
    };
  }

  const uploaderName =
    request.matter.client.contactName ?? request.matter.client.name;

  // The bytes go in first under a key nothing else can use, then the rows are
  // written under a lock on the request. Two uploads arriving together are
  // serialised there: each sees the other's version and takes the next number,
  // and neither can overwrite the other's file.
  const documentId = request.submittedDocument?.id ?? randomUUID();
  const stored = await putObject(
    uniqueDocumentKey(request.matter.id, documentId),
    bytes,
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DocumentRequest" WHERE id = ${request.id} FOR UPDATE`;

      const current = await tx.documentRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: { status: true, submittedDocumentId: true },
      });
      if (current.status === "ACCEPTED") throw new AlreadyAccepted();
      // Cancelled between the link check and the lock: the firm's decision wins.
      if (current.status === "CANCELLED") throw new Cancelled();

      // A correction becomes the next version of the same document, so the
      // earlier file the client sent is never lost.
      const targetId = current.submittedDocumentId ?? documentId;
      if (!current.submittedDocumentId) {
        await tx.document.create({
          data: {
            id: targetId,
            matterId: request.matter.id,
            folder: "CLIENT_UPLOADS",
            name: file.name,
          },
        });
      }

      const previous = await tx.documentVersion.findFirst({
        where: { documentId: targetId },
        orderBy: { versionNo: "desc" },
        select: { versionNo: true },
      });
      const next = (previous?.versionNo ?? 0) + 1;

      await tx.documentVersion.create({
        data: {
          documentId: targetId,
          versionNo: next,
          storageKey: stored.key,
          sha256: stored.sha256,
          byteSize: stored.byteSize,
          uploadedByType: "CLIENT",
          uploadedByName: uploaderName,
        },
      });
      await tx.documentRequest.update({
        where: { id: request.id },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          submittedDocumentId: targetId,
          reviewNote: null,
        },
      });
      await tx.secureLink.update({
        where: { id: result.linkId },
        data: { lastSeenAt: new Date() },
      });
      await tx.activityEvent.create({
        data: {
          matterId: request.matter.id,
          type: "REQUEST",
          summary: `${uploaderName} uploaded ${file.name}${
            next > 1 ? ` (v${next})` : ""
          }`,
          actorType: "CLIENT",
          actorName: uploaderName,
        },
      });
      await tx.notification.create({
        data: {
          firmId: request.matter.firmId,
          matterId: request.matter.id,
          text: `${uploaderName} uploaded ${file.name}`,
          href: `/matters/${request.matter.id}?tab=requests`,
        },
      });

    });
  } catch (error) {
    await deleteObject(stored.key).catch(() => {});
    if (error instanceof AlreadyAccepted) {
      return {
        ok: false,
        message: "Your lawyer has already accepted this document.",
      };
    }
    if (error instanceof Cancelled) {
      return { ok: false, message: "The firm cancelled this upload request." };
    }
    throw error;
  }

  revalidatePath(`/matters/${request.matter.id}`);
  return { ok: true };
}
