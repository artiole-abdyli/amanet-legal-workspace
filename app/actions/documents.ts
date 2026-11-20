"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { documentKey, putObject } from "@/lib/storage";

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
 */
export async function uploadMatterDocument(
  matterId: string,
  formData: FormData,
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_BYTES) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return;

  const existing = await prisma.document.findFirst({
    where: { matterId, folder: "CONTRACTS", name: file.name },
    include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });

  const document =
    existing ??
    (await prisma.document.create({
      data: { matterId, folder: "CONTRACTS", name: file.name },
    }));

  const versionNo = existing ? existing.versions[0].versionNo + 1 : 1;

  const stored = await putObject(
    documentKey(matterId, document.id, versionNo),
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
        uploadedByType: "ADMIN",
        uploadedByName: "Elena Vance",
      },
    }),
    prisma.activityEvent.create({
      data: {
        matterId,
        type: "DOCUMENT",
        summary:
          versionNo > 1
            ? `${file.name} v${versionNo} uploaded, earlier versions kept`
            : `${file.name} uploaded`,
        actorType: "ADMIN",
        actorName: "Elena Vance",
      },
    }),
  ]);

  revalidatePath(`/matters/${matterId}`);
  redirect(`/matters/${matterId}?tab=documents`);
}
