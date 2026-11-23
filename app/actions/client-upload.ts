"use server";

import { revalidatePath } from "next/cache";

import { openUploadLink } from "@/lib/link-access";
import { prisma } from "@/lib/prisma";
import { rateLimit, waitMessage } from "@/lib/rate-limit";
import { documentKey, putObject } from "@/lib/storage";

export type UploadOutcome = { ok: true } | { ok: false; message: string };

const MAX_BYTES = 20 * 1024 * 1024;

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

  // A correction becomes the next version of the same document, so the earlier
  // file the client sent is never lost.
  const document =
    request.submittedDocument ??
    (await prisma.document.create({
      data: {
        matterId: request.matter.id,
        folder: "CLIENT_UPLOADS",
        name: file.name,
      },
    }));

  const previous = await prisma.documentVersion.findFirst({
    where: { documentId: document.id },
    orderBy: { versionNo: "desc" },
    select: { versionNo: true },
  });
  const versionNo = (previous?.versionNo ?? 0) + 1;

  const stored = await putObject(
    documentKey(request.matter.id, document.id, versionNo),
    bytes,
  );

  await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNo,
        storageKey: stored.key,
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        uploadedByType: "CLIENT",
        uploadedByName: uploaderName,
      },
    }),
    prisma.documentRequest.update({
      where: { id: request.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedDocumentId: document.id,
        reviewNote: null,
      },
    }),
    prisma.secureLink.update({
      where: { id: result.linkId },
      data: { lastSeenAt: new Date() },
    }),
    prisma.activityEvent.create({
      data: {
        matterId: request.matter.id,
        type: "REQUEST",
        summary: `${uploaderName} uploaded ${file.name}${
          versionNo > 1 ? ` (v${versionNo})` : ""
        }`,
        actorType: "CLIENT",
        actorName: uploaderName,
      },
    }),
    prisma.notification.create({
      data: {
        firmId: request.matter.firmId,
        matterId: request.matter.id,
        text: `${uploaderName} uploaded ${file.name}`,
        href: `/matters/${request.matter.id}?tab=requests`,
      },
    }),
  ]);

  revalidatePath(`/matters/${request.matter.id}`);
  return { ok: true };
}
