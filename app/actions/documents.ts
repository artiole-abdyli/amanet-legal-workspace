"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertMatterWritable, requireAdminActor } from "@/lib/admin";
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
    where: { matterId, folder: "CONTRACTS", name: file.name },
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
        where: { matterId, folder: "CONTRACTS", name: file.name },
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
